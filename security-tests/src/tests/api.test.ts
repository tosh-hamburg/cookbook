/**
 * API - API-Sicherheitstests
 * 
 * Diese Tests sind SICHER für Produktionsumgebungen (read-only)
 * Sie prüfen Konfiguration und Header.
 */

import { CONFIG } from '../config';
import { getToken, authHeader } from '../setup';

describe('🌐 API - API-Sicherheitstests', () => {

  describe('API-01: CORS-Konfiguration', () => {
    
    test('CORS-Preflight-Request wird korrekt beantwortet', async () => {
      const res = await fetch(CONFIG.API_URL + '/health', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Authorization'
        }
      });

      // OPTIONS sollte 200 oder 204 sein
      expect([200, 204]).toContain(res.status);
      
      // CORS-Header prüfen
      const allowOrigin = res.headers.get('access-control-allow-origin');
      const allowMethods = res.headers.get('access-control-allow-methods');
      const allowHeaders = res.headers.get('access-control-allow-headers');
      
      console.log('\n📋 CORS-Konfiguration:');
      console.log(`   Allow-Origin: ${allowOrigin || 'nicht gesetzt'}`);
      console.log(`   Allow-Methods: ${allowMethods || 'nicht gesetzt'}`);
      console.log(`   Allow-Headers: ${allowHeaders || 'nicht gesetzt'}`);
      
      // Warnung bei zu permissiver Konfiguration
      if (allowOrigin === '*') {
        console.warn('   ⚠️ CORS erlaubt alle Origins (*)');
        console.warn('      Empfehlung: Explizite Whitelist verwenden');
      }
    });

    test('CORS mit bösartiger Origin', async () => {
      const res = await fetch(CONFIG.API_URL + '/health', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://evil-site.com',
          'Access-Control-Request-Method': 'POST'
        }
      });

      const allowOrigin = res.headers.get('access-control-allow-origin');
      
      // Dokumentiere das Verhalten
      if (allowOrigin === 'https://evil-site.com' || allowOrigin === '*') {
        console.warn('⚠️ CORS erlaubt requests von: https://evil-site.com');
      }
    });
  });

  describe('API-02: HTTP-Methoden', () => {
    
    test('TRACE-Methode ist deaktiviert', async () => {
      const res = await fetch(CONFIG.API_URL + '/health', {
        method: 'TRACE'
      });

      // TRACE sollte nicht erfolgreich sein
      expect(res.status).not.toBe(200);
      
      if (res.status === 200) {
        console.warn('⚠️ TRACE-Methode ist aktiviert - potentielles XST-Risiko');
      }
    });

    test('Unbekannte Methode wird abgelehnt', async () => {
      const res = await fetch(CONFIG.API_URL + '/recipes', {
        method: 'INVALID_METHOD'
      });

      expect([400, 405, 501]).toContain(res.status);
    });

    test('HEAD-Request auf GET-Endpoint', async () => {
      const res = await fetch(CONFIG.API_URL + '/health', {
        method: 'HEAD'
      });

      // HEAD sollte funktionieren
      expect(res.status).toBe(200);
      
      // Body sollte leer sein bei HEAD
      const text = await res.text();
      expect(text).toBe('');
    });
  });

  describe('API-06: Error-Information-Disclosure', () => {
    
    test('404-Fehler enthält keine sensiblen Informationen', async () => {
      const res = await fetchApi('/nonexistent-endpoint-12345');
      
      expect(res.status).toBe(404);
      
      const text = await res.text();
      
      // Keine Stack-Traces
      expect(text).not.toMatch(/at\s+\w+\s+\(/);
      expect(text).not.toMatch(/node_modules/);
      expect(text).not.toMatch(/\.js:\d+:\d+/);
      
      // Keine Pfadinformationen
      expect(text).not.toMatch(/\/home\//);
      expect(text).not.toMatch(/\/var\//);
      expect(text).not.toMatch(/C:\\/);
    });

    test('500-Fehler enthält keine Implementierungsdetails', async () => {
      // Versuche einen Fehler zu provozieren
      const res = await fetch(CONFIG.API_URL + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json {'
      });

      const text = await res.text();
      
      // Keine detaillierten Fehlermeldungen
      expect(text.toLowerCase()).not.toMatch(/unexpected token/);
      expect(text).not.toMatch(/SyntaxError/);
    });

    test('Datenbankfehler werden maskiert', async () => {
      const token = await getToken('user');
      if (!token) return;

      // Versuche ungültige UUID
      const res = await fetchApi('/recipes/invalid-uuid-format', {
        headers: authHeader(token)
      });

      const text = await res.text();
      
      // Keine Prisma/PostgreSQL-Fehlermeldungen
      expect(text).not.toMatch(/prisma/i);
      expect(text).not.toMatch(/postgresql/i);
      expect(text).not.toMatch(/invalid input syntax/i);
    });
  });

  describe('API-07: Security-Headers', () => {
    
    test('Security-Headers werden gesetzt', async () => {
      const res = await fetch(CONFIG.API_URL + '/health');
      
      const securityHeaders = {
        'X-Content-Type-Options': {
          value: res.headers.get('x-content-type-options'),
          expected: 'nosniff',
          description: 'Verhindert MIME-Type-Sniffing'
        },
        'X-Frame-Options': {
          value: res.headers.get('x-frame-options'),
          expected: ['DENY', 'SAMEORIGIN'],
          description: 'Schützt vor Clickjacking'
        },
        'X-XSS-Protection': {
          value: res.headers.get('x-xss-protection'),
          expected: ['1; mode=block', '0'],
          description: 'XSS-Filter (veraltet, CSP besser)'
        },
        'Strict-Transport-Security': {
          value: res.headers.get('strict-transport-security'),
          expected: 'max-age=',
          description: 'Erzwingt HTTPS'
        },
        'Content-Security-Policy': {
          value: res.headers.get('content-security-policy'),
          expected: null, // Optional für API
          description: 'Verhindert Code-Injection'
        },
        'Referrer-Policy': {
          value: res.headers.get('referrer-policy'),
          expected: ['no-referrer', 'strict-origin-when-cross-origin'],
          description: 'Kontrolliert Referrer-Information'
        },
        'Permissions-Policy': {
          value: res.headers.get('permissions-policy'),
          expected: null,
          description: 'Kontrolliert Browser-Features'
        }
      };

      console.log('\n📋 Security-Headers-Analyse:');
      
      let missingCount = 0;
      
      for (const [header, config] of Object.entries(securityHeaders)) {
        const status = config.value ? '✅' : '❌';
        console.log(`   ${status} ${header}: ${config.value || 'nicht gesetzt'}`);
        
        if (!config.value && config.expected) {
          missingCount++;
        }
      }

      if (missingCount > 0) {
        console.warn(`\n   ⚠️ ${missingCount} empfohlene Header fehlen`);
        console.warn('      Empfehlung: helmet.js Middleware verwenden');
      }
    });

    test('Server-Header gibt keine Version preis', async () => {
      const res = await fetch(CONFIG.API_URL + '/health');
      
      const serverHeader = res.headers.get('server');
      const poweredBy = res.headers.get('x-powered-by');
      
      console.log('\n📋 Server-Information:');
      console.log(`   Server: ${serverHeader || 'nicht gesetzt'}`);
      console.log(`   X-Powered-By: ${poweredBy || 'nicht gesetzt'}`);
      
      if (poweredBy) {
        console.warn('   ⚠️ X-Powered-By sollte entfernt werden');
        console.warn('      → app.disable("x-powered-by")');
      }
      
      if (serverHeader && serverHeader.match(/\d+\.\d+/)) {
        console.warn('   ⚠️ Server-Header enthält Versionsnummer');
      }
    });
  });

  describe('API-09: ID-Enumeration', () => {
    
    test('IDs sind nicht vorhersagbar (UUID v4)', async () => {
      const token = await getToken('user');
      if (!token) return;

      const res = await fetchApi('/auth/me', {
        headers: authHeader(token)
      });

      if (res.status !== 200) return;
      
      const user = await res.json() as { id: string };
      
      // UUID v4 Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      expect(user.id).toMatch(uuidV4Pattern);
      
      console.log(`\n📋 ID-Format: ${user.id.substring(0, 8)}...`);
      console.log('   ✅ UUID v4 Format - nicht sequentiell');
    });
  });

  describe('API-10: Rate-Limiting', () => {
    
    test('Brute-Force-Schutz prüfen', async () => {
      const attempts = CONFIG.BRUTE_FORCE_ATTEMPTS;
      let rateLimited = false;
      let requestCount = 0;

      console.log(`\n📋 Rate-Limiting-Test: ${attempts} Login-Versuche`);

      for (let i = 0; i < attempts; i++) {
        const res = await fetchApi('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            username: `bruteforce_test_${Date.now()}`,
            password: 'wrongpassword'
          })
        });
        
        requestCount++;

        if (res.status === 429) {
          rateLimited = true;
          console.log(`   ✅ Rate-Limit erreicht nach ${requestCount} Versuchen`);
          
          // Prüfe Retry-After Header
          const retryAfter = res.headers.get('retry-after');
          if (retryAfter) {
            console.log(`   Retry-After: ${retryAfter}s`);
          }
          break;
        }
        
        // Kleine Pause zwischen Requests
        await new Promise(r => setTimeout(r, 50));
      }

      if (!rateLimited) {
        console.warn(`   ⚠️ Kein Rate-Limiting nach ${attempts} Versuchen!`);
        console.warn('      Empfehlung: express-rate-limit implementieren');
        console.warn('      Beispiel: 5 Login-Versuche pro 15 Minuten');
      }
    });

    test('API-Anfragen Rate-Limiting', async () => {
      const token = await getToken('user');
      if (!token) return;

      const attempts = 50;
      let rateLimited = false;

      console.log(`\n📋 API Rate-Limiting-Test: ${attempts} Requests`);

      for (let i = 0; i < attempts; i++) {
        const res = await fetchApi('/recipes?limit=1', {
          headers: authHeader(token)
        });

        if (res.status === 429) {
          rateLimited = true;
          console.log(`   ✅ Rate-Limit erreicht nach ${i + 1} Requests`);
          break;
        }
      }

      if (!rateLimited) {
        console.warn(`   ⚠️ Kein API Rate-Limiting nach ${attempts} Requests`);
      }
    });
  });

  describe('API-11: Content-Type-Validierung', () => {
    
    test('Falscher Content-Type wird behandelt', async () => {
      const res = await fetch(CONFIG.API_URL + '/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: '{"username": "test", "password": "test"}'
      });

      // Sollte nicht 500 sein
      expect(res.status).not.toBe(500);
    });

    test('Kein Content-Type Header', async () => {
      const res = await fetch(CONFIG.API_URL + '/auth/login', {
        method: 'POST',
        body: '{"username": "test", "password": "test"}'
      });

      // Sollte nicht 500 sein
      expect(res.status).not.toBe(500);
    });
  });

  describe('API-12: Health-Endpoint', () => {
    
    test('Health-Check gibt keine sensiblen Daten preis', async () => {
      const res = await fetch(CONFIG.API_URL + '/health');
      
      expect(res.status).toBe(200);
      
      const data = await res.json();
      
      // Sollte keine sensiblen Informationen enthalten
      expect(data).not.toHaveProperty('database');
      expect(data).not.toHaveProperty('version');
      expect(data).not.toHaveProperty('env');
      expect(data).not.toHaveProperty('debug');
      
      // Nur Status und Timestamp sind ok
      expect((data as any).status).toBe('ok');
    });
  });

  describe('API-Extra: Sonstige Sicherheitsprüfungen', () => {
    
    test('HTTP-Methoden sind korrekt eingeschränkt', async () => {
      const token = await getToken('user');
      if (!token) return;

      // PATCH auf Endpoint der nur PUT erwartet
      const res = await fetchApi('/recipes/00000000-0000-0000-0000-000000000001', {
        method: 'PATCH',
        headers: authHeader(token),
        body: JSON.stringify({ title: 'Test' })
      });

      // Sollte 404 oder 405 sein (nicht 500)
      expect([404, 405]).toContain(res.status);
    });

    test('Cache-Control Header für API-Responses', async () => {
      const token = await getToken('user');
      if (!token) return;

      const res = await fetchApi('/auth/me', {
        headers: authHeader(token)
      });

      const cacheControl = res.headers.get('cache-control');
      
      console.log(`\n📋 Cache-Control: ${cacheControl || 'nicht gesetzt'}`);
      
      if (!cacheControl) {
        console.warn('   ⚠️ Cache-Control Header fehlt');
        console.warn('      Empfehlung: "no-store" für authentifizierte Daten');
      } else if (!cacheControl.includes('no-store') && !cacheControl.includes('private')) {
        console.warn('   ⚠️ Sensible Daten könnten gecacht werden');
      }
    });
  });
});
