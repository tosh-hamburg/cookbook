# Cookbook MCP-Server

MCP-Server für die Kochbuch-Anwendung. Damit lassen sich Rezepte direkt aus einer
Claude-Unterhaltung anlegen, ändern, suchen und importieren.

Der Server greift **nicht** direkt auf die Datenbank zu, sondern spricht die
bestehende REST-API (`/api/recipes`, `/api/categories`, `/api/collections`,
`/api/import`) an. Damit gelten dieselben Rechte wie in der Web-App: Ändern und
Löschen darf nur der Eigentümer eines Rezepts oder ein Admin.

## Werkzeuge

| Werkzeug | Zweck |
|----------|-------|
| `list_recipes` | Rezepte suchen/filtern (Titel, Kategorie, Sammlung), seitenweise |
| `get_recipe` | Ein Rezept mit allen Angaben lesen |
| `create_recipe` | Neues Rezept anlegen |
| `update_recipe` | Bestehendes Rezept ändern (nur die angegebenen Felder) |
| `delete_recipe` | Rezept löschen (verlangt `confirm: true`) |
| `list_categories` | Vorhandene Kategorien auflisten |
| `list_collections` | Sammlungen auflisten |
| `add_recipe_to_collection` | Rezept einer Sammlung zuordnen (Admin) |
| `remove_recipe_from_collection` | Zuordnung entfernen (Admin) |
| `import_recipe_from_url` | Rezept von einer Webseite übernehmen und speichern |

Drei Eigenheiten, die im Code bewusst gelöst sind:

* **Bilder verlassen den Server nie als Daten.** Rezeptbilder sind hier oft
  Base64-Data-URLs von mehreren hundert Kilobyte. Die Werkzeuge geben stattdessen
  nur Typ und ungefähre Größe zurück, damit ein einzelner Aufruf nicht das
  Kontextfenster füllt. Neue Bilder werden als `https://…`-URL übergeben.
* **`update_recipe` ist eine echte Teiländerung.** Das Backend behandelt
  `PUT /api/recipes/:id` als vollständiges Ersetzen und löscht dabei alle nicht
  mitgesendeten Zutaten und Kategorien. Der MCP-Server liest deshalb zuerst den
  aktuellen Stand, führt die Änderung damit zusammen und schickt den kompletten
  Datensatz. Weil die API weder `updatedAt` noch ein ETag liefert, ist dabei
  keine Kollisionsprüfung möglich: Wird dasselbe Rezept zeitgleich in der Web-App
  gespeichert, gewinnt der spätere Schreibvorgang.
* **Jeder Aufruf läuft unter der angemeldeten Person.** Beim HTTP-Transport
  bringt jede Anfrage über OAuth das Kochbuch-Token ihrer Person mit; es gibt
  kein gemeinsames Dienstkonto. Wer ein Rezept über Claude anlegt, ist auch in
  der Web-App dessen Eigentümer.

## Betriebsarten

| Transport | Anmeldung | Wann |
|-----------|-----------|------|
| `http` | OAuth mit Google-Konto, wie auf der Website | Server läuft auf der Synology, Claude verbindet sich über HTTPS |
| `stdio` | festes Konto aus der Konfiguration | Claude startet den Server lokal als Prozess |

## Anmeldung mit Google (HTTP-Transport)

Der Server ist zugleich sein eigener OAuth-Autorisierungsserver. Der Ablauf:

1. Claude ruft `/mcp` ohne Token auf und bekommt `401` mit einem Verweis auf
   `/.well-known/oauth-protected-resource/mcp`.
2. Claude liest die Metadaten, registriert sich selbst unter `/mcp/register` und
   öffnet den Browser auf `/mcp/authorize`. Der Server setzt dabei ein Cookie,
   das den Vorgang an genau diesen Browser bindet.
3. Der Server zeigt eine Anmeldeseite mit dem **„Mit Google anmelden"**-Knopf —
   derselbe Google-Client wie auf der Website.
4. Das Google-ID-Token geht an `POST /api/auth/google` des Backends und wird
   dort gegen ein Kochbuch-JWT getauscht. Nur wer bereits ein Konto im Kochbuch
   hat, kommt durch; das Backend legt keine neuen Benutzer an.
5. Danach zeigt die Seite, **wer** Zugriff bekommt und **wohin** die Antwort
   geht. Erst nach „Zugriff erlauben" entsteht der Autorisierungscode; „Abbrechen"
   meldet dem Client `access_denied`.
6. Claude tauscht den Autorisierungscode (mit PKCE) gegen Access- und
   Refresh-Token.

Das Access-Token gilt eine Stunde, das Refresh-Token 30 Tage. Bei jeder
Erneuerung frischt der Server auch das Kochbuch-JWT über
`POST /api/auth/refresh` auf — sonst wäre eine Sitzung nach sieben Tagen wertlos.
Beendet wird eine Sitzung dabei nur, wenn das Backend die Erneuerung wirklich
ablehnt (Konto gelöscht, Kulanzfrist überschritten). Ein Netzwerkfehler oder ein
Backend-Neustart lässt sie bestehen, sonst würde ein Deploy zur Unzeit alle
Angemeldeten hinauswerfen.

### Warum alles unter `/mcp` auf der Website-Domain liegt

Der Endpunkt ist `https://cookbook.gout-diary.com/mcp`, keine eigene Subdomain.
Das hat zwei handfeste Vorteile:

* Die Anmeldeseite läuft auf **derselben Origin wie die Website**. Die vorhandene
  Google-Client-ID ist dafür bereits freigegeben — in der Google Cloud Console
  ist **nichts** zu ändern.
* Kein zusätzliches Zertifikat und keine neue Reverse-Proxy-Regel auf der
  Synology nötig. Der Frontend-Container leitet `/mcp` intern weiter — im
  Betrieb über `frontend/nginx.conf`, beim lokalen `npm run dev` über die
  gleichlautenden Regeln in `frontend/vite.config.ts`.

Die SDK-Funktion `mcpAuthRouter` hängt ihre Endpunkte fest an den Domain-Root
(`/authorize`, `/token`, …) und würde dort mit den Routen der Web-App
kollidieren. Deshalb baut [`src/oauth/router.ts`](src/oauth/router.ts) den Router
aus den einzelnen SDK-Handlern selbst zusammen und legt alles unter `/mcp/…`.
Nur die beiden `.well-known`-Dokumente bleiben im Root, weil RFC 8414 und
RFC 9728 sie dort verlangen.

## Umgebungsvariablen

| Variable | Pflicht | Standard | Bedeutung |
|----------|---------|----------|-----------|
| `COOKBOOK_API_URL` | ja | – | Basis-URL der API, z. B. `http://backend:4002` |
| `MCP_TRANSPORT` | nein | `stdio` | `stdio` oder `http` |
| `MCP_PUBLIC_URL` | bei `http` | – | Öffentliche Basis-URL **ohne Pfad**, z. B. `https://cookbook.gout-diary.com` |
| `GOOGLE_CLIENT_ID` | bei `http` | – | Dieselbe Client-ID wie die Website |
| `MCP_DATA_DIR` | nein | `./.data` | Ablage für Clients und Sitzungen |
| `MCP_ALLOWED_REDIRECT_ORIGINS` | nein | `https://claude.ai,https://claude.com` | Zusätzlich zu Loopback erlaubte Rücksprung-Origins |
| `MCP_HTTP_HOST` | nein | `0.0.0.0` | Bind-Adresse |
| `MCP_HTTP_PORT` | nein | `4003` | Port im Container |
| `COOKBOOK_TOKEN` | bei `stdio` | – | Fertiges JWT |
| `COOKBOOK_USERNAME` | bei `stdio` | – | Kochbuch-Benutzername |
| `COOKBOOK_PASSWORD` | bei `stdio` | – | Passwort dazu |
| `COOKBOOK_TIMEOUT_MS` | nein | `30000` | Timeout je API-Aufruf |

Beim HTTP-Transport braucht der Server **keine** Zugangsdaten — jede Person
meldet sich selbst an. Beim stdio-Transport entweder `COOKBOOK_TOKEN` oder
`COOKBOOK_USERNAME` + `COOKBOOK_PASSWORD`; ist für das Konto 2FA aktiv,
funktioniert dort nur `COOKBOOK_TOKEN`.

## Einrichtung auf der Synology

In `.env` im Projektwurzelverzeichnis:

```
MCP_PORT=4003
MCP_PUBLIC_URL=https://cookbook.gout-diary.com
GOOGLE_CLIENT_ID=<dieselbe wie für die Website>
```

Starten:

```bash
cd /volume1/nodejs/cookbook
docker-compose up -d mcp frontend
docker-compose logs -f mcp
```

Prüfen (von außen, ohne Anmeldung erreichbar):

```bash
curl https://cookbook.gout-diary.com/.well-known/oauth-protected-resource/mcp
```

Die Antwort muss `"resource": "https://cookbook.gout-diary.com/mcp"` enthalten.

In Claude Code eintragen — **ohne** Token, die Anmeldung passiert im Browser:

```bash
claude mcp add --scope user --transport http cookbook https://cookbook.gout-diary.com/mcp
```

Beim ersten Zugriff öffnet Claude die Anmeldeseite. Dieselbe URL lässt sich in
claude.ai unter „Connectors → Eigenen Connector hinzufügen" eintragen.

## Einrichtung: lokal über stdio

```bash
cd mcp
npm install
npm run build
claude mcp add --scope user cookbook -- node Z:/cookbook/mcp/dist/index.js
```

Danach in `~/.claude.json` beim Eintrag `cookbook` die Zugangsdaten ergänzen
(Windows liest MCP-Server **ausschließlich** aus `~/.claude.json`, nicht aus
`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "cookbook": {
      "command": "node",
      "args": ["Z:/cookbook/mcp/dist/index.js"],
      "env": {
        "COOKBOOK_API_URL": "https://api.cookbook.gout-diary.com",
        "COOKBOOK_USERNAME": "…",
        "COOKBOOK_PASSWORD": "…"
      }
    }
  }
}
```

## Entwicklung

```bash
npm run dev            # Server im Watch-Modus (stdio)
npm run typecheck      # TypeScript prüfen
npm test               # Tests
npm run test:coverage  # Tests mit Coverage-Schwellen (80 % Zeilen)
```

Die Tests sprechen den echten MCP-Server an; nur `fetch` zur Kochbuch-API ist
durch ein Double ersetzt. [`src/transport/http.test.ts`](src/transport/http.test.ts)
läuft den kompletten OAuth-Ablauf gegen einen echten HTTP-Server durch —
Registrierung, Anmeldung, PKCE, Werkzeugaufruf, Erneuerung und Widerruf.

Hinweis für lokale Versuche mit `MCP_TRANSPORT=http`: Der Google-Knopf erscheint
nur auf einer Origin, die für die Client-ID freigegeben ist. `http://localhost`
ist das in der Regel nicht — der OAuth-Ablauf lässt sich lokal also nur bis zur
Anmeldeseite testen, alles Weitere deckt die Testsuite ab.

## Sicherheit

* **Kein gemeinsames Geheimnis mehr.** Es gibt keinen statischen Bearer-Token;
  Zugriff bekommt nur, wer sich mit einem Google-Konto anmeldet, das bereits
  einen Kochbuch-Benutzer hat.
* **Einwilligung statt stiller Weiterleitung.** Nach der Google-Anmeldung nennt
  die Seite Konto, anfragende Anwendung und Rücksprungziel und verlangt eine
  ausdrückliche Bestätigung. Ohne diesen Schritt könnte jemand einen eigenen
  Client registrieren, den fertigen Anmeldelink verschicken und so still Zugriff
  auf ein fremdes Kochbuch bekommen.
* **Bindung an den Browser.** `/mcp/authorize` setzt ein HttpOnly-Cookie; die
  Anmeldeseite und beide Folgeschritte verlangen es. Ein weitergeleiteter
  Anmeldelink funktioniert dadurch in keinem anderen Browser.
* **Rücksprungadressen sind eingeschränkt.** Registriert werden dürfen nur
  Loopback-Adressen (dort landet der Code auf dem eigenen Rechner) und die
  Origins aus `MCP_ALLOWED_REDIRECT_ORIGINS`. Ein Client, der Codes auf einen
  fremden Server umleiten will, wird schon bei der Registrierung abgewiesen.
* Token stehen im Speicher (`MCP_DATA_DIR/oauth.json`) nur als SHA-256-Hash. Die
  Kochbuch-JWTs müssen dort im Klartext liegen, damit sie die API aufrufen
  können — die Datei ist deshalb genauso schützenswert wie ein Passwort und wird
  mit Rechten `0600` angelegt. Sie liegt in einem Docker-Volume, nicht im Repo.
* PKCE (S256) ist Pflicht, Autorisierungscodes gelten fünf Minuten und nur ein
  einziges Mal, die Rücksprungadresse muss beim Tausch erneut übereinstimmen,
  und Refresh-Token werden bei jeder Erneuerung ausgetauscht.
* Die Anmeldeseite läuft unter einer Content-Security-Policy mit Nonce und
  `frame-ancestors 'none'`; das Ticket in der URL verlässt die Seite dank
  `Referrer-Policy: no-referrer` nicht.
* Der Container veröffentlicht keinen Port nach außen. Erreichbar ist er nur
  über den Frontend-Container (nginx) und damit über dasselbe HTTPS wie die
  Website.
* `/mcp` ist auf 120 Anfragen pro Minute und IP begrenzt; die OAuth-Endpunkte
  bringen eigene Grenzen aus der SDK mit.
* `import_recipe_from_url` lässt nur öffentliche http(s)-Adressen durch
  ([`src/url-guard.ts`](src/url-guard.ts)). Die URL wird vom Backend serverseitig
  abgerufen; ohne diese Prüfung könnte ein Modell, das eine URL aus einem fremden
  Dokument übernimmt, damit interne Adressen abfragen lassen.
* Eingebettete Base64-Bilder sind auf ~1,5 MB je Bild und ~2,2 MB insgesamt
  begrenzt, damit derselbe Aufruf über stdio und über HTTP gleich reagiert.
* `delete_recipe` verlangt `confirm: true`, damit ein Löschen nicht beiläufig
  passiert.

### Zugriff entziehen

Eine Sitzung endet, sobald Claude die Verbindung entfernt (Widerruf über
`/mcp/revoke`) oder das Refresh-Token nach 30 Tagen abläuft. Sofort und für alle
gleichzeitig geht es über den Speicher:

```bash
docker-compose exec mcp sh -c 'rm /data/oauth.json'
docker-compose restart mcp
```

Danach müssen sich alle erneut anmelden.
