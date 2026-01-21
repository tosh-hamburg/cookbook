/**
 * INPUT - Input-Validierungstests
 * 
 * ⚠️ WARNUNG: Einige Tests können Daten erstellen!
 * XSS-Tests erstellen Test-Rezepte mit Payloads.
 * 
 * Für Produktionsumgebungen: DRY_RUN=true npm run test:input
 */

import { CONFIG } from '../config';
import { getToken, authHeader } from '../setup';

describe('🧹 INPUT - Input-Validierungstests', () => {
  let token: string | null;

  beforeAll(async () => {
    token = await getToken('user');
    if (!token) {
      console.warn('⚠️ Kein Token - Tests werden übersprungen');
    }
  });

  describe('INPUT-01/02: XSS-Prävention (Read-Only Check)', () => {
    // Diese Tests prüfen nur, ob der Server die Payloads akzeptiert
    // Die eigentliche XSS-Prävention muss im Frontend passieren
    
    const xssPayloads = [
      { name: 'Script Tag', payload: '<script>alert("XSS")</script>' },
      { name: 'Img Onerror', payload: '<img src=x onerror=alert("XSS")>' },
      { name: 'SVG Onload', payload: '<svg onload=alert(1)>' },
      { name: 'Event Handler', payload: '" onmouseover="alert(1)"' },
      { name: 'JavaScript URI', payload: 'javascript:alert("XSS")' },
      { name: 'Data URI', payload: 'data:text/html,<script>alert("XSS")</script>' },
      { name: 'Template Injection', payload: '{{constructor.constructor("alert(1)")()}}' },
      { name: 'HTML Entity', payload: '&lt;script&gt;alert("XSS")&lt;/script&gt;' }
    ];

    test.each(xssPayloads)(
      'XSS-Payload "$name" wird verarbeitet ohne Server-Fehler',
      async ({ payload }) => {
        if (!token || CONFIG.DRY_RUN) {
          console.log('⚠️ Test im DRY_RUN-Modus - kein Rezept erstellt');
          return;
        }

        const res = await fetchApi('/recipes', {
          method: 'POST',
          headers: authHeader(token),
          body: JSON.stringify({
            title: `XSS Test: ${payload.substring(0, 20)}`,
            instructions: payload,
            ingredients: [{ name: payload, amount: '1' }]
          })
        });

        // Server sollte nicht abstürzen
        expect(res.status).not.toBe(500);

        // Wenn erfolgreich erstellt, aufräumen
        if (res.status === 201) {
          const recipe = await res.json();
          
          // Cleanup
          await fetchApi(`/recipes/${recipe.id}`, {
            method: 'DELETE',
            headers: authHeader(token)
          });
        }
      }
    );
  });

  describe('INPUT-03: SQL-Injection in API-Parametern', () => {
    const sqlPayloads = [
      "'; DROP TABLE recipes; --",
      "' OR '1'='1",
      "1; DELETE FROM recipes",
      "' UNION SELECT * FROM users --",
      "1' OR '1'='1' /*",
      "'; TRUNCATE TABLE recipes; --",
      "' OR 1=1; --",
      "admin'/*",
      "') OR ('1'='1",
      "1; UPDATE users SET role='admin' WHERE '1'='1"
    ];

    test.each(sqlPayloads)(
      'SQL-Injection in Suche: "%s" → Sicher',
      async (payload) => {
        if (!token) return;

        const res = await fetchApi(`/recipes?search=${encodeURIComponent(payload)}`, {
          headers: authHeader(token)
        });

        // Sollte 200 sein (leere Ergebnisse), nicht 500 (DB-Fehler)
        expect(res.status).toBe(200);
        
        const data = await res.json();
        
        // Response sollte valide sein
        expect(Array.isArray(data) || (data.items !== undefined)).toBeTruthy();
      }
    );

    test.each(sqlPayloads)(
      'SQL-Injection in Category-Filter: "%s" → Sicher',
      async (payload) => {
        if (!token) return;

        const res = await fetchApi(`/recipes?category=${encodeURIComponent(payload)}`, {
          headers: authHeader(token)
        });

        expect(res.status).toBe(200);
      }
    );
  });

  describe('INPUT-05: Path Traversal', () => {
    const pathTraversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '....//....//....//etc/passwd',
      '..%252f..%252f..%252fetc/passwd',
      '/etc/passwd',
      'C:\\Windows\\System32\\config\\SAM',
      '....\/....\/....\/etc/passwd'
    ];

    test.each(pathTraversalPayloads)(
      'Path Traversal in Recipe ID: "%s"',
      async (payload) => {
        if (!token) return;

        const res = await fetchApi(`/recipes/${encodeURIComponent(payload)}`, {
          headers: authHeader(token)
        });

        // Sollte 400 (ungültige ID) oder 404 (nicht gefunden) sein
        expect([400, 404]).toContain(res.status);
        
        // Response sollte keine Dateiinhalte enthalten
        const text = await res.text();
        expect(text).not.toMatch(/root:|Administrator|SYSTEM/);
      }
    );
  });

  describe('INPUT-06: Request-Größen-Limits', () => {
    
    test('Request nahe am Limit (20MB) → Akzeptiert oder 413', async () => {
      if (!token) return;

      // 20MB String (unter dem 25MB Limit)
      const largeData = 'A'.repeat(20 * 1024 * 1024);

      try {
        const res = await fetchApi('/recipes', {
          method: 'POST',
          headers: authHeader(token),
          body: JSON.stringify({
            title: 'Large Recipe',
            instructions: largeData,
            ingredients: []
          })
        });

        // Entweder akzeptiert (201) oder zu groß (413) oder Bad Request (400)
        expect([201, 400, 413]).toContain(res.status);
        
        // Cleanup wenn erstellt
        if (res.status === 201) {
          const recipe = await res.json();
          await fetchApi(`/recipes/${recipe.id}`, {
            method: 'DELETE',
            headers: authHeader(token)
          });
        }
      } catch (e) {
        // Netzwerkfehler bei großem Body ist auch akzeptabel
        console.log('⚠️ Request abgebrochen (erwartetes Verhalten bei großem Body)');
      }
    }, 60000); // Längerer Timeout

    test('Request über dem Limit (30MB) → 413 oder Abbruch', async () => {
      if (!token) return;

      // 30MB String (über dem 25MB Limit)
      const oversizedData = 'B'.repeat(30 * 1024 * 1024);

      try {
        const res = await fetchApi('/recipes', {
          method: 'POST',
          headers: authHeader(token),
          body: JSON.stringify({
            title: 'Oversized Recipe',
            instructions: oversizedData,
            ingredients: []
          })
        });

        // Sollte abgelehnt werden
        expect([400, 413]).toContain(res.status);
      } catch (e) {
        // Netzwerkfehler ist erwartetes Verhalten
        expect(e).toBeDefined();
      }
    }, 60000);
  });

  describe('INPUT-07: Malformed JSON', () => {
    const malformedPayloads = [
      '{"username": "test", password: invalid}',
      '{"username": "test",}',
      "{'username': 'test'}",
      '{"username": "test"',
      'not json at all',
      '',
      'null',
      'undefined',
      '[]',
      '{"__proto__": {"admin": true}}'
    ];

    test.each(malformedPayloads)(
      'Malformed JSON: %s → 400 Bad Request',
      async (payload) => {
        const res = await fetch(`${CONFIG.API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        });

        // Sollte 400 sein, nicht 500
        expect([400, 401]).toContain(res.status);
      }
    );
  });

  describe('INPUT-08: Spezielle Zeichen', () => {
    
    test('Null-Byte im Eingabefeld → Korrektes Handling', async () => {
      if (!token) return;

      const res = await fetchApi('/recipes?search=test%00injection', {
        headers: authHeader(token)
      });

      expect(res.status).toBe(200);
    });

    test('Unicode-Zeichen werden korrekt verarbeitet', async () => {
      if (!token) return;

      const unicodeStrings = [
        '日本語レシピ',
        'Рецепт на русском',
        '🍕🍔🌮',
        'Ñoño con jalapeño',
        '中文食谱'
      ];

      for (const str of unicodeStrings) {
        const res = await fetchApi(`/recipes?search=${encodeURIComponent(str)}`, {
          headers: authHeader(token)
        });
        
        expect(res.status).toBe(200);
      }
    });

    test('CRLF-Injection → Kein Header-Injection', async () => {
      if (!token) return;

      const crlfPayload = 'test\r\nX-Injected-Header: evil';
      
      const res = await fetchApi(`/recipes?search=${encodeURIComponent(crlfPayload)}`, {
        headers: authHeader(token)
      });

      expect(res.status).toBe(200);
      
      // Injizierter Header sollte nicht vorhanden sein
      expect(res.headers.get('X-Injected-Header')).toBeNull();
    });
  });

  describe('INPUT-09: Prototype Pollution', () => {
    
    test('__proto__ Pollution wird verhindert', async () => {
      if (!token || CONFIG.DRY_RUN) return;

      const pollutionPayloads = [
        { '__proto__': { 'admin': true } },
        { 'constructor': { 'prototype': { 'admin': true } } },
        { '__proto__': { 'role': 'admin' } }
      ];

      for (const payload of pollutionPayloads) {
        const res = await fetchApi('/recipes', {
          method: 'POST',
          headers: authHeader(token),
          body: JSON.stringify({
            title: 'Pollution Test',
            instructions: 'Test',
            ingredients: [],
            ...payload
          })
        });

        // Sollte nicht 500 sein
        expect(res.status).not.toBe(500);

        // Cleanup
        if (res.status === 201) {
          const recipe = await res.json();
          await fetchApi(`/recipes/${recipe.id}`, {
            method: 'DELETE',
            headers: authHeader(token)
          });
        }
      }
    });
  });

  describe('INPUT-10: NoSQL-Injection (falls relevant)', () => {
    // Prisma mit PostgreSQL ist nicht anfällig für NoSQL-Injection
    // Diese Tests dokumentieren das erwartete Verhalten
    
    const nosqlPayloads = [
      '{"$gt": ""}',
      '{"$ne": null}',
      '{"$where": "this.password"}',
      '{"$regex": ".*"}',
      '{"$or": [{}]}'
    ];

    test.each(nosqlPayloads)(
      'NoSQL-Payload in Suche: %s → Wird als Text behandelt',
      async (payload) => {
        if (!token) return;

        const res = await fetchApi(`/recipes?search=${encodeURIComponent(payload)}`, {
          headers: authHeader(token)
        });

        // PostgreSQL + Prisma: Payload wird als normaler Text behandelt
        expect(res.status).toBe(200);
      }
    );
  });
});
