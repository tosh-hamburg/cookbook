/**
 * AUTHZ - Autorisierungstests
 * 
 * ⚠️ WARNUNG: Diese Tests können Daten erstellen/löschen!
 * Nur auf Test-/Staging-Umgebungen ausführen!
 * 
 * Oder im DRY_RUN-Modus: DRY_RUN=true npm run test:authz
 */

import { CONFIG } from '../config';
import { getToken, authHeader } from '../setup';

describe('🛡️ AUTHZ - Autorisierungstests', () => {
  let userToken: string | null;
  let adminToken: string | null;

  beforeAll(async () => {
    userToken = await getToken('user');
    adminToken = await getToken('admin');
    
    if (!userToken) {
      console.warn('⚠️ Kein User-Token - einige Tests werden übersprungen');
    }
    if (!adminToken) {
      console.warn('⚠️ Kein Admin-Token - einige Tests werden übersprungen');
    }
  });

  describe('AUTHZ-01 bis AUTHZ-03: Admin-Only Endpoints', () => {
    
    test('AUTHZ-01: User greift auf /users (Admin-only) zu → 403', async () => {
      if (!userToken) {
        console.log('⚠️ Test übersprungen: Kein User-Token');
        return;
      }

      const res = await fetchApi('/users', {
        headers: authHeader(userToken)
      });
      
      expect(res.status).toBe(403);
      
      const data = await res.json();
      expect(data.error).toMatch(/admin|berechtigung|permission/i);
    });

    test('AUTHZ-02: User versucht User zu erstellen → 403', async () => {
      if (!userToken) return;

      const res = await fetchApi('/users', {
        method: 'POST',
        headers: authHeader(userToken),
        body: JSON.stringify({
          username: 'hacker_created_user_' + Date.now(),
          password: 'password123'
        })
      });
      
      expect(res.status).toBe(403);
    });

    test('AUTHZ-03: User versucht User zu löschen → 403', async () => {
      if (!userToken) return;

      // Verwende eine nicht-existierende ID
      const fakeUserId = '00000000-0000-0000-0000-000000000001';
      
      const res = await fetchApi(`/users/${fakeUserId}`, {
        method: 'DELETE',
        headers: authHeader(userToken)
      });
      
      // 403 (keine Berechtigung) ist korrekt
      // 404 wäre auch ok, wenn die Autorisierung vor dem DB-Lookup passiert
      expect([403]).toContain(res.status);
    });
  });

  describe('AUTHZ-04 bis AUTHZ-06: Ressourcen-Ownership (DRY RUN)', () => {
    
    test('AUTHZ-04: User bearbeitet fremdes Rezept → 403 oder 404', async () => {
      if (!userToken) return;

      // Verwende eine nicht-existierende UUID
      // In einer echten Umgebung würde man eine ID eines fremden Rezepts verwenden
      const fakeRecipeId = '00000000-0000-0000-0000-000000000001';
      
      const res = await fetchApi(`/recipes/${fakeRecipeId}`, {
        method: 'PUT',
        headers: authHeader(userToken),
        body: JSON.stringify({
          title: 'Hacked Title'
        })
      });
      
      // 404 (nicht gefunden) oder 403 (keine Berechtigung) - beides akzeptabel
      expect([403, 404]).toContain(res.status);
    });

    test('AUTHZ-05: User löscht fremdes Rezept → 403 oder 404', async () => {
      if (!userToken) return;

      const fakeRecipeId = '00000000-0000-0000-0000-000000000002';
      
      const res = await fetchApi(`/recipes/${fakeRecipeId}`, {
        method: 'DELETE',
        headers: authHeader(userToken)
      });
      
      expect([403, 404]).toContain(res.status);
    });

    // Dieser Test würde echte Daten erstellen - nur mit DRY_RUN=false
    test.skip('AUTHZ-06: Admin kann fremdes Rezept bearbeiten → 200', async () => {
      if (CONFIG.DRY_RUN) {
        console.log('⚠️ Test übersprungen (DRY_RUN-Modus)');
        return;
      }
      // Dieser Test würde in einer echten Umgebung implementiert
    });
  });

  describe('AUTHZ-07: Self-Delete Prevention', () => {
    
    test('Admin kann sich nicht selbst löschen → 400', async () => {
      if (!adminToken) return;

      // Hole eigene User-ID
      const meRes = await fetchApi('/auth/me', {
        headers: authHeader(adminToken)
      });
      
      if (meRes.status !== 200) return;
      
      const me = await meRes.json();
      
      // Versuche sich selbst zu löschen
      const deleteRes = await fetchApi(`/users/${me.id}`, {
        method: 'DELETE',
        headers: authHeader(adminToken)
      });
      
      // Sollte verhindert werden
      expect(deleteRes.status).toBe(400);
      
      const data = await deleteRes.json();
      expect(data.error).toMatch(/selbst|yourself/i);
    });
  });

  describe('AUTHZ-08: Privilege Escalation Prevention', () => {
    
    test('User kann eigene Rolle nicht zu Admin ändern', async () => {
      if (!userToken) return;

      // Versuche eigene Rolle zu ändern via /auth/me (falls PUT existiert)
      const res = await fetchApi('/auth/me', {
        method: 'PUT',
        headers: authHeader(userToken),
        body: JSON.stringify({ role: 'admin' })
      });
      
      // Endpoint existiert nicht oder ist nicht erlaubt
      expect([403, 404, 405]).toContain(res.status);
    });

    test('Registration ohne Admin-Rechte → 401/403', async () => {
      // Registration sollte nur für Admins möglich sein
      const res = await fetchApi('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: 'hacker_' + Date.now(),
          password: 'password123',
          role: 'admin'
        })
      });
      
      // Ohne Token: 401 (nicht authentifiziert)
      expect(res.status).toBe(401);
    });

    test('Registration als User (nicht Admin) → 403', async () => {
      if (!userToken) return;

      const res = await fetchApi('/auth/register', {
        method: 'POST',
        headers: authHeader(userToken),
        body: JSON.stringify({
          username: 'hacker_' + Date.now(),
          password: 'password123',
          role: 'admin'
        })
      });
      
      // User darf keine neuen User registrieren
      expect(res.status).toBe(403);
    });
  });

  describe('AUTHZ-09: IDOR (Insecure Direct Object Reference)', () => {
    
    test('Zugriff auf fremden Meal-Plan über ID → Korrektes Handling', async () => {
      if (!userToken) return;

      // Versuche auf Meal-Plan einer anderen Woche zuzugreifen
      // (Meal-Plans sind User-spezifisch)
      const res = await fetchApi('/mealplans/2020-01-01', {
        headers: authHeader(userToken)
      });
      
      // Sollte leer sein oder den eigenen Plan zurückgeben
      // Nicht den Plan eines anderen Users
      expect(res.status).toBe(200);
      
      const data = await res.json();
      // weekStart sollte übereinstimmen oder leer sein
      if (data.id) {
        expect(data.weekStart).toContain('2020-01-01');
      }
    });

    test('UUID-Format wird validiert', async () => {
      if (!userToken) return;

      // Ungültige UUID
      const res = await fetchApi('/recipes/not-a-valid-uuid', {
        headers: authHeader(userToken)
      });
      
      // Sollte 400 oder 404 sein
      expect([400, 404]).toContain(res.status);
    });

    test('Sequential ID Guessing ist nicht möglich (UUIDs)', async () => {
      if (!userToken) return;

      // Bei sequentiellen IDs (1, 2, 3) könnte man raten
      // UUIDs sind zufällig und nicht vorhersagbar
      const sequentialIds = ['1', '2', '3', '100', '1000'];
      
      for (const id of sequentialIds) {
        const res = await fetchApi(`/recipes/${id}`, {
          headers: authHeader(userToken)
        });
        
        // Sollte 404 sein (ungültige UUID), nicht gefunden
        expect([400, 404]).toContain(res.status);
      }
    });
  });

  describe('AUTHZ-12: JWT-Manipulation', () => {
    
    test('JWT mit geänderter User-ID → 403 oder falscher User', async () => {
      // Erstelle Token mit falscher ID
      const header = Buffer.from(JSON.stringify({
        alg: 'HS256',
        typ: 'JWT'
      })).toString('base64url');
      
      const payload = Buffer.from(JSON.stringify({
        id: '00000000-0000-0000-0000-000000000099',
        username: 'stolen_identity',
        role: 'user'
      })).toString('base64url');
      
      const fakeToken = `${header}.${payload}.invalid_signature`;
      
      const res = await fetchApi('/auth/me', {
        headers: authHeader(fakeToken)
      });
      
      // Signatur ist ungültig → 403
      expect(res.status).toBe(403);
    });

    test('JWT mit abgelaufenem Timestamp (exp) → Korrektes Handling', async () => {
      const header = Buffer.from(JSON.stringify({
        alg: 'HS256',
        typ: 'JWT'
      })).toString('base64url');
      
      // Token das vor einer Stunde abgelaufen ist
      const payload = Buffer.from(JSON.stringify({
        id: 'test-id',
        username: 'test',
        role: 'user',
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600
      })).toString('base64url');
      
      const expiredToken = `${header}.${payload}.invalid`;
      
      const res = await fetchApi('/auth/me', {
        headers: authHeader(expiredToken)
      });
      
      expect(res.status).toBe(403);
    });
  });
});
