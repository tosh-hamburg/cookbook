/**
 * Konfiguration für Security-Tests
 * 
 * Umgebungsvariablen:
 *   API_URL          - Backend-URL (Standard: https://cookbook.dunker.one/api)
 *   TEST_USER        - Testbenutzer-Name
 *   TEST_PASSWORD    - Testbenutzer-Passwort
 *   ADMIN_USER       - Admin-Benutzer-Name
 *   ADMIN_PASSWORD   - Admin-Benutzer-Passwort
 */
export const CONFIG = {
  // API-URL - anpassen für lokale Tests oder Staging
  API_URL: process.env.API_URL || 'https://cookbook.dunker.one/api',
  
  // Test-Benutzer (sollte ein dedizierter Test-Account sein)
  TEST_USER: {
    username: process.env.TEST_USER || 'security_test_user',
    password: process.env.TEST_PASSWORD || 'TestPassword123!'
  },
  
  // Admin-Benutzer für Autorisierungstests
  ADMIN_USER: {
    username: process.env.ADMIN_USER || 'security_test_admin',
    password: process.env.ADMIN_PASSWORD || 'AdminPassword123!'
  },
  
  // Timeouts
  REQUEST_TIMEOUT: 10000,
  
  // Brute-Force-Test-Limits
  BRUTE_FORCE_ATTEMPTS: 10,
  
  // Test-Modi
  DRY_RUN: process.env.DRY_RUN === 'true', // Keine Daten modifizieren
};

// Validierung
if (CONFIG.API_URL.includes('localhost') || CONFIG.API_URL.includes('127.0.0.1')) {
  console.log('⚠️  Tests laufen gegen lokale Umgebung');
}

if (CONFIG.API_URL.includes('cookbook.dunker.one')) {
  console.log('⚠️  Tests laufen gegen PRODUKTIONSUMGEBUNG');
  console.log('   Nur sichere (read-only) Tests werden empfohlen!');
  console.log('   Verwende: npm run test:safe');
}
