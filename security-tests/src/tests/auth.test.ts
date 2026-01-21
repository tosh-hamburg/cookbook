/**
 * AUTH - Authentifizierungstests
 * 
 * Diese Tests sind SICHER für Produktionsumgebungen (read-only)
 * Sie erstellen oder löschen keine Daten.
 */

import { CONFIG } from '../config';
import { getToken } from '../setup';

describe('🔐 AUTH - Authentifizierungstests', () => {
  
  describe('AUTH-01 bis AUTH-04: Login-Validierung', () => {
    
    test('AUTH-01: Login ohne Credentials → 400 Bad Request', async () => {
      const res = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({})
      });
      expect(res.status).toBe(400);
      
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    test('AUTH-02: Login mit falschem Passwort → 401 Unauthorized', async () => {
      const res = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: CONFIG.TEST_USER.username,
          password: 'definitiv_falsches_passwort_12345!'
        })
      });
      expect(res.status).toBe(401);
    });

    test('AUTH-03: Login mit nicht existentem User → 401 Unauthorized', async () => {
      const res = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: 'nonexistent_user_' + Date.now(),
          password: 'anypassword'
        })
      });
      expect(res.status).toBe(401);
      
      // Fehlermeldung sollte keine Information preisgeben, ob User existiert
      const data = await res.json();
      expect(data.error).not.toMatch(/nicht gefunden|not found|does not exist/i);
    });

    test('AUTH-04: Login mit korrekten Credentials → 200 + Token oder 2FA', async () => {
      const res = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: CONFIG.TEST_USER.username,
          password: CONFIG.TEST_USER.password
        })
      });
      
      expect(res.status).toBe(200);
      
      const data = await res.json();
      
      // Entweder Token oder 2FA-Anforderung
      if (data.token) {
        expect(typeof data.token).toBe('string');
        expect(data.token.split('.')).toHaveLength(3); // JWT Format
        expect(data.user).toBeDefined();
      } else if (data.requires2FA) {
        expect(data.requires2FA).toBe(true);
      } else {
        fail('Weder Token noch 2FA-Anforderung erhalten');
      }
    });
  });

  describe('AUTH-05 bis AUTH-08: Token-Validierung', () => {
    
    test('AUTH-05: API-Zugriff ohne Token → 401 Unauthorized', async () => {
      const res = await fetchApi('/recipes');
      expect(res.status).toBe(401);
    });

    test('AUTH-06: API-Zugriff mit ungültigem Token → 403 Forbidden', async () => {
      const res = await fetchApi('/recipes', {
        headers: {
          'Authorization': 'Bearer invalid_token_12345'
        }
      });
      expect(res.status).toBe(403);
    });

    test('AUTH-07: API-Zugriff mit manipuliertem Token → 403 Forbidden', async () => {
      const token = await getToken('user');
      if (!token) {
        console.log('⚠️ Test übersprungen: Kein gültiger Token verfügbar');
        return;
      }
      
      // Token manipulieren (letzte 5 Zeichen ändern)
      const manipulatedToken = token.slice(0, -5) + 'XXXXX';
      
      const res = await fetchApi('/recipes', {
        headers: {
          'Authorization': `Bearer ${manipulatedToken}`
        }
      });
      expect(res.status).toBe(403);
    });

    test('AUTH-08: JWT mit manipulierter Payload (role: admin) → 403', async () => {
      // Erstelle einen gefälschten JWT mit admin-Rolle
      const header = Buffer.from(JSON.stringify({
        alg: 'HS256',
        typ: 'JWT'
      })).toString('base64url');
      
      const payload = Buffer.from(JSON.stringify({
        id: 'fake-id-12345',
        username: 'hacker',
        role: 'admin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      })).toString('base64url');
      
      const fakeSignature = 'fake_signature_not_valid';
      const fakeAdminToken = `${header}.${payload}.${fakeSignature}`;
      
      const res = await fetchApi('/users', {
        headers: {
          'Authorization': `Bearer ${fakeAdminToken}`
        }
      });
      
      // Sollte 403 sein (ungültige Signatur), nicht 200
      expect(res.status).toBe(403);
    });
  });

  describe('AUTH-12: SQL-Injection im Login', () => {
    const sqlInjectionPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "admin'--",
      "' UNION SELECT * FROM users --",
      "1; SELECT * FROM users",
      "' OR 1=1 --",
      "'; INSERT INTO users VALUES ('hacker', 'password'); --",
      "' OR ''='",
      "1' OR '1'='1' /*",
      "') OR ('1'='1"
    ];

    test.each(sqlInjectionPayloads)(
      'SQL-Injection: "%s" → Keine SQL-Ausführung',
      async (payload) => {
        const res = await fetchApi('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            username: payload,
            password: payload
          })
        });
        
        // Sollte 400 (Bad Request) oder 401 (Unauthorized) sein
        // Nicht 500 (Server Error) - das würde auf DB-Problem hindeuten
        expect([400, 401]).toContain(res.status);
        
        // Fehlertext sollte keine SQL-Details enthalten
        const data = await res.json();
        if (data.error) {
          expect(data.error.toLowerCase()).not.toMatch(/sql|syntax|query|select|insert|drop/);
        }
      }
    );
  });

  describe('AUTH-15: Timing-Attack-Resistenz', () => {
    
    test('Konsistente Antwortzeit für existierende vs. nicht-existierende User', async () => {
      const attempts = 5;
      const existingUserTimes: number[] = [];
      const nonExistingUserTimes: number[] = [];

      for (let i = 0; i < attempts; i++) {
        // Existierender User mit falschem Passwort
        const start1 = Date.now();
        await fetchApi('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            username: CONFIG.TEST_USER.username,
            password: 'wrongpassword_' + i
          })
        });
        existingUserTimes.push(Date.now() - start1);

        // Nicht-existierender User
        const start2 = Date.now();
        await fetchApi('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            username: `nonexistent_user_${Date.now()}_${i}`,
            password: 'wrongpassword'
          })
        });
        nonExistingUserTimes.push(Date.now() - start2);
        
        // Kleine Pause zwischen Requests
        await new Promise(r => setTimeout(r, 100));
      }

      const avgExisting = existingUserTimes.reduce((a, b) => a + b) / attempts;
      const avgNonExisting = nonExistingUserTimes.reduce((a, b) => a + b) / attempts;
      const timingDifference = Math.abs(avgExisting - avgNonExisting);
      
      console.log(`\n⏱️  Timing-Analyse:`);
      console.log(`   Existierender User:     ${avgExisting.toFixed(0)}ms (avg)`);
      console.log(`   Nicht-existierender:    ${avgNonExisting.toFixed(0)}ms (avg)`);
      console.log(`   Differenz:              ${timingDifference.toFixed(0)}ms`);
      
      // Warnung bei großer Differenz
      if (timingDifference > 100) {
        console.warn('   ⚠️  Mögliche Timing-Attack-Schwachstelle (>100ms Differenz)');
      } else {
        console.log('   ✅ Timing-Differenz akzeptabel');
      }
      
      // Toleranz für Netzwerk-Varianz (500ms)
      expect(timingDifference).toBeLessThan(500);
    });
  });

  describe('AUTH-Extra: Zusätzliche Authentifizierungstests', () => {
    
    test('Leerer Authorization-Header → 401', async () => {
      const res = await fetchApi('/recipes', {
        headers: {
          'Authorization': ''
        }
      });
      expect(res.status).toBe(401);
    });

    test('Authorization ohne Bearer → 401', async () => {
      const res = await fetchApi('/recipes', {
        headers: {
          'Authorization': 'some-token-without-bearer'
        }
      });
      expect(res.status).toBe(401);
    });

    test('Bearer ohne Token → 401/403', async () => {
      const res = await fetchApi('/recipes', {
        headers: {
          'Authorization': 'Bearer '
        }
      });
      expect([401, 403]).toContain(res.status);
    });

    test('Null-Byte im Username → 401', async () => {
      const res = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: 'admin\x00',
          password: 'password'
        })
      });
      expect(res.status).toBe(401);
    });

    test('Unicode im Username → Korrektes Handling', async () => {
      const res = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: '用户名',
          password: 'password'
        })
      });
      // Sollte 401 sein, nicht 500
      expect([400, 401]).toContain(res.status);
    });

    test('Extrem langer Username → Korrektes Handling', async () => {
      const longUsername = 'a'.repeat(10000);
      const res = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: longUsername,
          password: 'password'
        })
      });
      // Sollte 400 oder 401 sein, nicht 500
      expect([400, 401]).toContain(res.status);
    });
  });
});
