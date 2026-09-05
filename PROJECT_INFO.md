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
| Frontend (Vite Dev Server) | 3002 |
| Backend (Express API) | 4002 |
| MCP-Server (Streamable HTTP, nur intern) | 4003 |
| PostgreSQL | 5435 |

## Domains

- Lokal: http://synology:3002
- Test Frontend: https://cookbook.gout-diary.com
- Test API: https://api.cookbook.gout-diary.com
- MCP-Endpunkt: https://cookbook.gout-diary.com/mcp (keine eigene Subdomain — der Frontend-Container leitet /mcp weiter)

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

# Logs eines Services anzeigen
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
docker-compose logs -f mcp

# Container neu starten
docker-compose restart backend
docker-compose restart frontend

# Datenbank-Migration ausführen
docker-compose exec backend npx prisma migrate dev

# Prisma Studio (Datenbank-GUI)
docker-compose exec backend npx prisma studio

# In Container einloggen
docker-compose exec backend sh
docker-compose exec frontend sh
docker-compose exec db psql -U cookbook -d cookbook
```

## Entwicklung

### Backend
- Express.js mit TypeScript
- Prisma ORM für Datenbankzugriff
- JWT-basierte Authentifizierung
- Hot-Reload mit nodemon

### Frontend
- React 18 mit TypeScript
- Vite als Build-Tool
- TailwindCSS für Styling
- Hot-Reload mit Vite Dev Server

### MCP-Server
- Node.js mit TypeScript, `@modelcontextprotocol/sdk`
- Spricht die Backend-REST-API an (kein direkter DB-Zugriff)
- Zwei Transporte: stdio (lokal) und Streamable HTTP (Container `cookbook-mcp`)
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
