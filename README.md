# 📖 Cookbook

**Werbefreie Kochrezeptverwaltung für dein eigenes Netzwerk**

Cookbook ist eine selbst-gehostete Webanwendung zur Verwaltung von Kochrezepten. Importiere Rezepte von beliebten Rezeptseiten, organisiere sie in Sammlungen und greife von überall in deinem Netzwerk darauf zu – komplett werbefrei.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)

## ✨ Features

- 🍳 **Rezepte verwalten** – Erstelle, bearbeite und lösche Rezepte mit Bildern, Zutaten und Zubereitungsschritten
- 📥 **Rezept-Import** – Importiere Rezepte direkt von Chefkoch.de, Kochbar.de und anderen Seiten
- 📁 **Sammlungen** – Organisiere Rezepte in eigenen Sammlungen (z.B. "Sommerrezepte", "Schnelle Gerichte")
- 🏷️ **Kategorien** – Filtere Rezepte nach Kategorien
- 👥 **Portionsrechner** – Passe Zutatenmengen automatisch an die gewünschte Portionszahl an
- 📅 **Wochenplaner** – Plane Mahlzeiten für die Woche (Frühstück, Mittag, Abend) mit automatischer Zutaten-Aggregation
- 🛒 **Einkaufsliste** – Exportiere Zutaten für Google Keep via Gemini (für einzelne Rezepte oder den gesamten Wochenplan)
- 🔐 **Benutzerverwaltung** – Multi-User-Support mit Admin- und Benutzer-Rollen
- 🔑 **Google SSO** – Anmeldung mit Google-Account
- 🛡️ **2FA** – Optionale Zwei-Faktor-Authentifizierung
- 📱 **Responsive Design** – Optimiert für Desktop, Tablet und Smartphone
- 📲 **Android App** – Native Android-App als mobiles Frontend (siehe [Android App](#-android-app))

## 🖼️ Screenshots

<details>
<summary>Screenshots anzeigen</summary>

*Screenshots hier einfügen*

</details>

## 🚀 Installation

### Voraussetzungen

- Docker & Docker Compose
- (Optional) Reverse Proxy für HTTPS (z.B. Nginx, Traefik, Synology Reverse Proxy)

### Quick Start

1. **Repository klonen**
   ```bash
   git clone https://github.com/dein-username/cookbook.git
   cd cookbook
   ```

2. **Umgebungsvariablen konfigurieren**
   ```bash
   cp .env.example .env
   # .env bearbeiten und Werte anpassen
   ```

3. **Container starten**
   ```bash
   docker-compose up -d
   ```

4. **Anwendung öffnen**
   - Frontend: http://localhost:3002
   - Standard-Login: `admin` / `admin123`

### Konfiguration

Erstelle eine `.env` Datei im Projektverzeichnis:

```env
# Datenbank
POSTGRES_DB=cookbook
POSTGRES_USER=cookbook
POSTGRES_PASSWORD=sicheres_passwort_hier

# Backend
JWT_SECRET=zufaelliger_geheimer_schluessel
NODE_ENV=production

# Ports
FRONTEND_PORT=3002
BACKEND_PORT=4002
POSTGRES_PORT=5435

# Google OAuth (optional)
GOOGLE_CLIENT_ID=deine-google-client-id.apps.googleusercontent.com
```

### Google SSO einrichten (optional)

1. Gehe zur [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Erstelle eine OAuth 2.0 Client-ID (Webanwendung)
3. Füge deine Domain zu "Autorisierte JavaScript-Quellen" hinzu
4. Trage die Client-ID in der `.env` ein
5. Erstelle `frontend/.env` mit `VITE_GOOGLE_CLIENT_ID=...`

## 🏗️ Architektur

```
cookbook/
├── frontend/          # React + Vite + TypeScript
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/   # UI-Komponenten
│   │   │   │   ├── WeeklyPlanner.tsx      # Wochenplaner
│   │   │   │   ├── RecipeSearchDialog.tsx # Rezeptsuche-Dialog
│   │   │   │   └── ...
│   │   │   ├── services/     # API-Client
│   │   │   ├── types/        # TypeScript-Typen
│   │   │   │   ├── recipe.ts
│   │   │   │   ├── mealplan.ts  # Wochenplaner-Typen
│   │   │   │   └── user.ts
│   │   │   └── utils/        # Hilfsfunktionen
│   │   └── main.tsx
│   └── package.json
│
├── backend/           # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── routes/          # API-Endpunkte
│   │   ├── middleware/      # Auth-Middleware
│   │   └── index.ts
│   ├── prisma/
│   │   └── schema.prisma    # Datenbankschema
│   └── package.json
│
├── docker-compose.yml
└── .env
```

### Tech Stack

| Komponente | Technologie |
|------------|-------------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express, TypeScript, Prisma ORM, Sharp (Bildverarbeitung) |
| Datenbank | PostgreSQL 16 |
| Auth | JWT, bcrypt, Google OAuth 2.0, TOTP (2FA) |
| Container | Docker, Docker Compose |
| Mobile | Kotlin, Jetpack, Retrofit, Material Design 3 |

## 📅 Wochenplaner

Der Wochenplaner ermöglicht die Planung von Mahlzeiten für eine gesamte Woche:

**Funktionen:**
- 📆 Kalenderansicht einer Woche (Montag bis Sonntag)
- 🍽️ Drei Mahlzeiten pro Tag (Frühstück, Mittagessen, Abendessen)
- 🔍 Rezeptauswahl mit Volltextsuche, Kategorie- und Sammlungsfilter
- 👥 Individuelle Portionsangabe pro Mahlzeit
- 🧮 Automatische Zutaten-Aggregation (gleiche Zutaten werden zusammengerechnet)
- 🛒 Export der gesamten Einkaufsliste an Gemini/Google Keep

**So nutzt du den Wochenplaner:**
1. Klicke auf "Wochenplaner" im Header
2. Wähle die gewünschte Woche (Standard: kommende Woche)
3. Klicke auf einen Mahlzeit-Slot und wähle ein Rezept
4. Passe die Portionszahl mit +/- an
5. Klicke auf "Einkaufsliste erstellen" um alle Zutaten an Gemini zu senden

## 📲 Android App

Eine native Android-App ist als mobiles Frontend verfügbar. Der Quellcode befindet sich im separaten Repository/Ordner `cookbookApp`.

**Features der Android App:**
- 📱 Native Android-Erfahrung
- 🔐 Login mit Benutzername/Passwort oder Google SSO
- 📖 Rezepte durchsuchen, anzeigen und bearbeiten
- 📷 Fotos direkt mit der Kamera aufnehmen oder aus der Galerie hinzufügen
- 👥 Portionsrechner mit automatischer Mengenberechnung
- 📁 Sammlungen verwalten
- 🛒 Zutaten an Gemini senden
- 🔄 Automatische Netzwerkerkennung (intern/extern)

**Technologie:**
- Kotlin
- Jetpack Components (ViewModel, Navigation)
- Retrofit + OkHttp
- Coil für Bildverarbeitung
- Material Design 3

## 📥 Rezept-Import

Cookbook kann Rezepte automatisch von verschiedenen Webseiten importieren:

| Webseite | Status |
|----------|--------|
| Chefkoch.de | ✅ Vollständig |
| Kochbar.de | ✅ Vollständig |
| Weitere (JSON-LD) | ✅ Automatisch |

Der Import nutzt strukturierte Daten (JSON-LD/schema.org) und HTML-Parsing als Fallback.

**So importierst du ein Rezept:**
1. Klicke auf "Rezept importieren"
2. Füge die URL des Rezepts ein
3. Das Rezept wird mit Bildern, Zutaten und Anleitung importiert

## 🔧 Entwicklung

### Lokale Entwicklung

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (neues Terminal)
cd frontend
npm install
npm run dev
```

### Mit Docker (empfohlen)

```bash
docker-compose up
```

Die Anwendung nutzt Volume-Mounts und Hot-Reloading – Änderungen am Code werden sofort übernommen.

## 📝 API-Dokumentation

### Authentifizierung

| Endpunkt | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/auth/login` | POST | Login mit Benutzername/Passwort |
| `/api/auth/google` | POST | Login mit Google |
| `/api/auth/me` | GET | Aktueller Benutzer |
| `/api/auth/change-password` | POST | Passwort ändern |
| `/api/auth/2fa/setup` | POST | 2FA einrichten |
| `/api/auth/2fa/verify` | POST | 2FA verifizieren |
| `/api/auth/2fa/disable` | POST | 2FA deaktivieren |

### Rezepte

| Endpunkt | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/recipes` | GET | Alle Rezepte (mit Filter & Paginierung) |
| `/api/recipes/:id` | GET | Einzelnes Rezept |
| `/api/recipes` | POST | Rezept erstellen |
| `/api/recipes/:id` | PUT | Rezept bearbeiten |
| `/api/recipes/:id` | DELETE | Rezept löschen |
| `/api/import` | POST | Rezept von URL importieren |

**Query-Parameter für `/api/recipes`:**

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `category` | string | Filter nach Kategorie |
| `collection` | string | Filter nach Sammlungs-ID |
| `search` | string | Volltextsuche im Titel |
| `full` | boolean | `true` = vollständige Rezeptdaten (Web), `false` = Thumbnails + Basis-Infos (Mobile) |
| `limit` | number | Anzahl Rezepte pro Seite (nur ohne `full=true`, max. 100) |
| `offset` | number | Offset für Paginierung (nur ohne `full=true`) |

**Antwortformate:**

Mit `full=true` (Web-App):
```json
[
  { "id": "...", "title": "...", "ingredients": [...], "instructions": "...", ... }
]
```

Ohne `full=true` (Mobile App, paginiert):
```json
{
  "items": [{ "id": "...", "title": "...", "thumbnail": "...", ... }],
  "total": 42,
  "limit": 20,
  "offset": 0,
  "hasMore": true
}
```

### Sammlungen & Kategorien

| Endpunkt | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/collections` | GET/POST | Sammlungen |
| `/api/collections/:id/recipes/:recipeId` | POST/DELETE | Rezept zu Sammlung |
| `/api/categories` | GET/POST/DELETE | Kategorien |

## 🤝 Beitragen

Beiträge sind willkommen! Bitte erstelle einen Fork und einen Pull Request.

1. Fork erstellen
2. Feature-Branch erstellen (`git checkout -b feature/neues-feature`)
3. Änderungen committen (`git commit -m 'Neues Feature hinzugefügt'`)
4. Branch pushen (`git push origin feature/neues-feature`)
5. Pull Request erstellen

## 📄 Lizenz

MIT License – siehe [LICENSE](LICENSE) für Details.

## 🙏 Danksagungen

- [shadcn/ui](https://ui.shadcn.com/) – UI-Komponenten
- [Prisma](https://www.prisma.io/) – Datenbank ORM
- [Lucide](https://lucide.dev/) – Icons
- [Sharp](https://sharp.pixelplumbing.com/) – Bildverarbeitung & Thumbnails
- [Retrofit](https://square.github.io/retrofit/) – HTTP-Client für Android

---

**Made with ❤️ for home cooks who value privacy**
