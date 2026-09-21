# Kochbuch-Anwendung - Projektinformationen

## Zugang zur Synology

```bash
ssh adm_ssh@synology
```

## Pfade auf der Synology

| Zweck | Pfad |
|-------|------|
| Source-Code | `/volume1/nodejs/cookbook/` |
| Frontend | `/volume1/nodejs/cookbook/frontend/` |
| Backend | `/volume1/nodejs/cookbook/backend/` |
| MCP-Server | `/volume1/nodejs/cookbook/mcp/` |
| PostgreSQL Daten | `/volume1/docker/cookbook-postgresql/` |

## Ports

| Service | Port |
|---------|------|
| Frontend (nginx im Container `cookbook-app`, liefert den Build aus) | 3002 |
| Backend (Express API, gleicher Container) | 4002 |
| MCP-Server (Streamable HTTP, nur containerintern) | 4003 |
| PostgreSQL | 5435 |

## Domains

- Lokal: http://synology:3002
- Test Frontend: https://cookbook.gout-diary.com
- Test API: https://api.cookbook.gout-diary.com
- MCP-Endpunkt: https://cookbook.gout-diary.com/mcp (keine eigene Subdomain — nginx im App-Container leitet /mcp weiter)

## Docker-Befehle

```bash
# Auf der Synology
cd /volume1/nodejs/cookbook

# Container starten
docker-compose up -d

# Container stoppen
docker-compose down

# Logs anzeigen (alle)
docker-compose logs -f

# Logs eines Services anzeigen (app = Backend + MCP-Server + nginx)
docker-compose logs -f app
docker-compose logs -f db

# Nach Codeaenderungen neu bauen und starten: docker/start.sh installiert die
# Abhaengigkeiten, baut Backend, MCP-Server und Frontend, spielt offene
# Prisma-Migrationen ein und startet die drei Prozesse (dauert einige Minuten,
# Fortschritt in den Logs)
docker-compose up -d --force-recreate app

# Ausstehende Datenbank-Migrationen von Hand einspielen (macht start.sh sonst automatisch)
docker-compose exec app sh -c "cd backend && npx prisma migrate deploy"

# Neue Migration aus Schema-Aenderungen erzeugen (nur Entwicklung)
docker-compose exec app sh -c "cd backend && npx prisma migrate dev"

# Backend-Tests (Unit-Tests; mit TEST_DATABASE_URL zusaetzlich gegen eine
# migrierte PostgreSQL-Datenbank, z. B. fuer die Volltextsuche-Trigger)
cd backend && npm test

# Prisma Studio (Datenbank-GUI)
docker-compose exec app sh -c "cd backend && npx prisma studio"

# In Container einloggen
docker-compose exec app bash
docker-compose exec db psql -U cookbook -d cookbook
```

Der Container `cookbook-app` (Image `node:22-bookworm-slim`) haengt `/volume1/nodejs/cookbook`
als `/app` ein; die `node_modules` der drei Pakete liegen in Named Volumes. Innerhalb des
Containers: nginx auf :80 (liefert `frontend/dist` aus, leitet `/api`, `/mcp` und
`/.well-known/oauth-*` weiter), Backend auf :4002, MCP-Server auf :4003 (nur Loopback).
Stirbt einer der drei Prozesse, beendet sich der Container und wird neu gestartet.

## Entwicklung

### Backend
- Express.js mit TypeScript
- Prisma ORM für Datenbankzugriff
- JWT-basierte Authentifizierung
- Im Betrieb kompiliert: `npm run build` + `npm start` (kein ts-node/nodemon)
- Lokal `npm run dev` mit Hot-Reload

### Frontend
- React 18 mit TypeScript
- Vite als Build-Tool
- TailwindCSS für Styling
- Im Betrieb baut `docker/start.sh` einmalig `frontend/dist`, danach liefert
  nginx (im selben Container) den Build aus und verteilt `/api`, `/mcp` und die
  `/.well-known/oauth-*`-Dokumente an Backend und MCP-Server auf Loopback
  (`frontend/nginx.conf`)
- Lokal weiterhin `npm run dev` mit Hot-Reload; die Proxy-Regeln dafür stehen
  in `frontend/vite.config.ts` und müssen zu `nginx.conf` passen
- `npm run typecheck` (tsc, `frontend/tsconfig.json`) vor jedem Commit
- Design „Küchentisch" (Rezeptbibliothek, Rezeptdetail, Kochmodus, Wochenplaner):
  Tokens in `src/styles/theme.css`, Vorlage in `design_handoff_rezeptbibliothek_2a/`
- `node_modules` fuer Frontend und Backend auf der Synology installieren (Linux-Binaries),
  nicht von Windows aus: `node /volume1/@appstore/Node.js_v22/usr/local/lib/node_modules/npm/bin/npm-cli.js ci`
  (das `npm` im PATH der Synology ist ein toter Symlink)

### MCP-Server
- Node.js mit TypeScript, `@modelcontextprotocol/sdk`
- Spricht die Backend-REST-API an (kein direkter DB-Zugriff)
- Zwei Transporte: stdio (lokal) und Streamable HTTP (im Container `cookbook-app`, Port 4003 nur Loopback)
- Anmeldung beim HTTP-Transport über OAuth 2.1 + PKCE mit "Mit Google anmelden";
  derselbe Google-Client wie die Website, dadurch keine Änderung in der Google
  Cloud Console nötig
- Sitzungen liegen im Docker-Volume `mcp_data` unter `/data/oauth.json`
- Details und Claude-Einrichtung: `mcp/README.md`

## API-Endpunkte

### Authentifizierung
- `POST /api/auth/login` - Anmeldung
- `POST /api/auth/register` - Registrierung (nur Admin)

### Rezepte
- `GET /api/recipes` - Alle Rezepte abrufen
- `GET /api/recipes/:id` - Einzelnes Rezept abrufen
- `POST /api/recipes` - Rezept erstellen
- `PUT /api/recipes/:id` - Rezept aktualisieren
- `DELETE /api/recipes/:id` - Rezept löschen
- `POST /api/recipes/:id/cooked` - Kochvorgang vermerken (Kochzähler +1, Body optional `{ servings }`)
- `PUT /api/recipes/:id/favorite` / `DELETE /api/recipes/:id/favorite` - Rezept merken / Markierung entfernen

Alle Rezeptantworten enthalten pro Nutzer `cookCount`, `lastCookedAt` und `isFavorite`
(Tabellen `CookEvent` und `RecipeFavorite`, Migration `20260921120000_add_favorites_and_cook_events`).
„Rezept der Woche" in der Web-App ist das Rezept mit dem höchsten Kochzähler.

### Kategorien
- `GET /api/categories` - Alle Kategorien abrufen
- `POST /api/categories` - Kategorie erstellen
- `DELETE /api/categories/:id` - Kategorie löschen

### Benutzer (Admin)
- `GET /api/users` - Alle Benutzer abrufen
- `POST /api/users` - Benutzer erstellen
- `DELETE /api/users/:id` - Benutzer löschen

## Datenbank

### Verbindungsdaten
- Host: `db` (innerhalb Docker) / `localhost` (von außen)
- Port: `5432` (innerhalb Docker) / `5435` (von außen)
- Datenbank: `cookbook`
- Benutzer: `cookbook`
- Passwort: `cookbook_secret`

### Connection String
```
postgresql://cookbook:cookbook_secret@db:5432/cookbook
```
