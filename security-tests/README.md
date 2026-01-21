# 🔐 Cookbook Security Tests

Automatisierte Sicherheitstests für die Cookbook Web-API.

## 📋 Übersicht

| Test-Suite | Beschreibung | Sicher für Produktion? |
|------------|--------------|------------------------|
| `auth.test.ts` | Authentifizierungstests | ✅ Ja (read-only) |
| `api.test.ts` | API-Sicherheitstests | ✅ Ja (read-only) |
| `authz.test.ts` | Autorisierungstests | ⚠️ Teilweise |
| `input.test.ts` | Input-Validierung | ⚠️ Kann Daten erstellen |

## 🚀 Installation

```bash
cd security-tests
npm install
```

## 🧪 Tests ausführen

### Sichere Tests (Produktion)

```bash
# Nur read-only Tests (AUTH + API)
npm run test:safe
```

### Alle Tests (Staging/Lokal)

```bash
# Alle Tests
npm test

# Einzelne Test-Suites
npm run test:auth    # Authentifizierung
npm run test:authz   # Autorisierung
npm run test:input   # Input-Validierung
npm run test:api     # API-Sicherheit
```

### Mit Custom-Konfiguration

```bash
# Gegen lokale Umgebung
API_URL=http://localhost:4002/api npm test

# Mit Test-Credentials
TEST_USER=myuser TEST_PASSWORD=mypass npm test

# DRY-RUN Modus (keine Daten ändern)
DRY_RUN=true npm test
```

## ⚙️ Konfiguration

Umgebungsvariablen in `src/config.ts`:

| Variable | Beschreibung | Standard |
|----------|--------------|----------|
| `API_URL` | Backend-URL | `https://cookbook.dunker.one/api` |
| `TEST_USER` | Test-Benutzer | `security_test_user` |
| `TEST_PASSWORD` | Test-Passwort | `TestPassword123!` |
| `ADMIN_USER` | Admin-Benutzer | `security_test_admin` |
| `ADMIN_PASSWORD` | Admin-Passwort | `AdminPassword123!` |
| `DRY_RUN` | Keine Daten ändern | `false` |

## 📊 Test-Report

```bash
# JSON-Report erstellen
npm run test:report

# Report liegt dann in: security-report.json
```

## 🧪 Test-Kategorien

### AUTH - Authentifizierung
- Login-Validierung
- Token-Prüfung
- SQL-Injection
- Timing-Attacks

### AUTHZ - Autorisierung
- Admin-Endpoint-Schutz
- Ressourcen-Ownership
- Privilege Escalation
- JWT-Manipulation

### INPUT - Input-Validierung
- XSS-Prävention
- SQL-Injection (Parameter)
- Path Traversal
- Request-Größen-Limits
- Malformed JSON
- Prototype Pollution

### API - API-Sicherheit
- CORS-Konfiguration
- Security-Headers
- Error-Disclosure
- Rate-Limiting
- HTTP-Methoden

## ⚠️ Wichtige Hinweise

1. **Backup erstellen** vor Tests auf Produktionsdaten
2. **Test-Accounts** verwenden, nicht echte Benutzer
3. **DRY_RUN=true** für erste Durchläufe empfohlen
4. **Rate-Limiting** kann Tests verlangsamen

## 📝 Empfohlene Verbesserungen

Basierend auf der Code-Analyse:

1. **Rate-Limiting** implementieren
   ```bash
   npm install express-rate-limit
   ```

2. **Security-Headers** hinzufügen
   ```bash
   npm install helmet
   ```

3. **CORS** restriktiver konfigurieren
   ```typescript
   app.use(cors({
     origin: ['https://cookbook.dunker.one'],
     credentials: true
   }));
   ```

4. **JWT_SECRET** in Produktion sicher setzen
   ```bash
   export JWT_SECRET=$(openssl rand -base64 32)
   ```

## 📄 Lizenz

Intern - Nur für Cookbook-Projekt
