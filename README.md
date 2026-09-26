# 📖 Cookbook

**Ad-free recipe management for your own network**

Cookbook is a self-hosted web application for managing cooking recipes. Import recipes from popular recipe sites, organize them in collections, plan your week, and cook along step by step – completely ad-free.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)

## ✨ Features

- 🍳 **Manage Recipes** – Create, edit, and delete recipes with images, ingredients, and preparation steps
- 📥 **Recipe Import** – Import recipes from Chefkoch.de, Kochbar.de, Zeit.de, and any site with schema.org data
- 🔎 **Full-Text Search** – Search titles, ingredients, notes, and instructions (German stemming, prefix and substring matching)
- 📁 **Collections** – Organize recipes in custom collections (e.g., "Summer Recipes", "Quick Dishes")
- 🏷️ **Categories** – Filter recipes by categories
- 👥 **Serving Calculator** – Automatically adjust ingredient amounts to the desired number of servings
- 👩‍🍳 **Cook Mode** – Full-screen step-by-step view with timers, keyboard control, and a screen that stays awake
- ❤️ **Favorites & Cook Counter** – Mark favorites and track how often and when you cooked a recipe (per user)
- 📅 **Weekly Planner** – Plan breakfast, lunch, and dinner for the week, with several dishes per meal (e.g., main course and dessert) and drag & drop
- 🛒 **Shopping List** – Aggregated ingredients of the whole week, exportable to Google Keep via Gemini
- 🔐 **User Management** – Multi-user support with admin and user roles
- 🔑 **Google SSO** – Sign in with Google account
- 🛡️ **2FA** – Optional two-factor authentication
- 📱 **Responsive Design** – Optimized for desktop, tablet, and smartphone
- 📲 **Android App** – Native Android app as mobile frontend (see [Android App](#-android-app))
- 🤖 **MCP Server** – Create and edit recipes straight from a Claude conversation, signing in with Google (see [MCP Server](#-mcp-server))

## 🖼️ Screenshots

### Web Application

<details>
<summary>Show Web App Screenshots</summary>

#### Recipe Overview
The library opens with the recipe of the week, followed by your collection – filter by collection, mark favorites, and see time, servings, and calories at a glance.

![Recipe Overview](screenshots/web-recipe-list.png)

#### Recipe Detail View
Photos, ingredients with serving calculator and checkboxes, your own note, and numbered steps with timers. Start cook mode or plan the recipe for a day right from here.

![Recipe Detail](screenshots/web-recipe-detail.png)

#### Weekly Planner
Plan breakfast, lunch, and dinner for the week – several dishes per meal (here: a casserole with pico de gallo on Sunday), suggestions by cooking frequency, and an aggregated shopping list.

![Weekly Planner](screenshots/web-weekly-planner.png)

</details>

### Android App

<details>
<summary>Show Android App Screenshots</summary>

#### Recipe Overview (Mobile)
Browse recipes in a clean, card-based grid layout.

![Recipe Overview Mobile](screenshots/android-recipe-list.png)

#### Recipe Detail (Mobile)
View full recipe details with serving calculator and quick actions.

![Recipe Detail Mobile](screenshots/android-recipe-detail.png)

#### Weekly Planner (Mobile)
Manage your weekly meal plan with an intuitive day-by-day view.

![Weekly Planner Mobile](screenshots/android-weekly-planner.png)

</details>

## 🚀 Installation

### Prerequisites

- Docker & Docker Compose
- (Optional) Reverse proxy for HTTPS (e.g., Nginx, Traefik, Synology Reverse Proxy)

### Quick Start

1. **Clone repository**
   ```bash
   git clone https://github.com/tosh-hamburg/cookbook.git
   cd cookbook
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and adjust values (see Configuration)
   ```

3. **Adjust the host paths in `docker-compose.yml`**

   The compose file mounts Synology paths: `/volume1/nodejs/cookbook` (the source
   checkout, mounted as `/app`) and `/volume1/docker/cookbook-postgresql` (the
   database files). Point both to the matching directories on your host.

4. **Start containers**
   ```bash
   docker-compose up -d
   docker-compose logs -f app   # follow the first start
   ```

   The first start takes a few minutes: the `app` container installs the
   dependencies, builds backend, MCP server, and frontend, and applies all
   pending database migrations before it starts serving.

5. **Create the first admin user**

   There is no default account, and Google sign-in only works for users that
   already exist. Create the first admin inside the container:
   ```bash
   docker exec -it cookbook-app bash -c 'cd /app/backend && node -e "
   const { PrismaClient } = require(\"@prisma/client\");
   const bcrypt = require(\"bcryptjs\");
   (async () => {
     const prisma = new PrismaClient();
     await prisma.user.create({ data: { username: \"admin\", password: await bcrypt.hash(process.argv[1], 10), role: \"admin\" } });
     await prisma.\$disconnect();
   })();" "YOUR-PASSWORD"'
   ```
   Further users are created by an admin in the web app (Administration → Users).

6. **Open application**
   - Web app: http://localhost:3002

### Configuration

Create a `.env` file in the project directory (template: [.env.example](.env.example)):

```env
# Database
POSTGRES_DB=cookbook
POSTGRES_USER=cookbook
POSTGRES_PASSWORD=secure_password_here

# Backend
JWT_SECRET=random_secret_key
# 32-byte key for encrypting sensitive data (e.g. the Zeit.de session cookie):
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=64_hex_characters
NODE_ENV=production
# Allowed browser origins (comma-separated)
CORS_ORIGINS=https://cookbook.example.com,http://localhost:3002

# Ports
FRONTEND_PORT=3002   # nginx: web app, /api, /mcp
BACKEND_PORT=4002    # backend API, published directly for the Android app
POSTGRES_PORT=5435
MCP_PORT=4003        # internal only, reached through nginx

# MCP server (public base URL of this site, no path)
MCP_PUBLIC_URL=https://cookbook.gout-diary.com

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

### Setting up Google SSO (optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (Web application)
3. Add your domain to "Authorized JavaScript origins"
4. Enter the Client ID in `.env`
5. Create `frontend/.env` with `VITE_GOOGLE_CLIENT_ID=...`

### Updating

```bash
git pull
docker-compose up -d --remove-orphans   # or redeploy the stack in Portainer
docker-compose restart app              # if the container is already up to date
```

Every start of the `app` container rebuilds all packages from the mounted
source and runs `prisma migrate deploy`, so new database migrations are applied
automatically.

## 🤖 MCP Server

The `mcp/` package exposes the cookbook as an [MCP](https://modelcontextprotocol.io)
server, so recipes can be created, edited, searched, and imported from a Claude
conversation ("add a lentil soup for 4 people", "import this recipe URL",
"double the resting time on the sourdough").

It is reachable at **`https://cookbook.gout-diary.com/mcp`** — the same domain as
the web app, no separate subdomain. You sign in with **your Google account**,
exactly like on the website: Claude opens a sign-in page, you confirm which app
gets access, and every tool call then runs under your own cookbook user with your
own permissions. No shared service account and no API token to configure.

**Run it** — the MCP server runs inside the `app` container next to the backend;
nginx forwards `/mcp` and the OAuth discovery documents to it:

```env
MCP_PORT=4003
MCP_PUBLIC_URL=https://cookbook.gout-diary.com
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

```bash
docker-compose up -d
curl https://cookbook.gout-diary.com/.well-known/oauth-protected-resource/mcp
```

**Connect Claude Code** — no token, the browser handles the login:

```bash
claude mcp add --scope user --transport http cookbook https://cookbook.gout-diary.com/mcp
```

Running it locally over stdio instead, the available tools, and the security
notes are documented in [mcp/README.md](mcp/README.md).

## 🏗️ Architecture

Two containers: `db` (PostgreSQL) and `app`, which runs the backend, the MCP
server, and nginx together ([docker/start.sh](docker/start.sh)).

```
cookbook/
├── docker/
│   └── start.sh             # app container: install, build, migrate, start
│
├── frontend/          # React + Vite + TypeScript (built, served by nginx)
│   ├── nginx.conf           # Production serving + /api and /mcp routing
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── library/      # Recipe library (hero, collection pills, week band)
│   │   │   │   ├── detail/       # Recipe detail (ingredients, steps, notes)
│   │   │   │   ├── planner/      # Weekly planner grid, suggestions, shopping list
│   │   │   │   ├── CookMode.tsx  # Full-screen cook mode
│   │   │   │   ├── ui/           # shadcn/ui components
│   │   │   │   └── ...
│   │   │   ├── hooks/        # useWeekPlan, useRecipeSearch, useWakeLock, ...
│   │   │   ├── i18n/         # German and English texts
│   │   │   ├── services/     # API client
│   │   │   ├── types/        # TypeScript types (recipe, mealplan, user)
│   │   │   └── utils/        # Amounts, steps, shopping list, planner slots, ...
│   │   ├── styles/theme.css  # Design tokens
│   │   └── main.tsx
│   └── package.json
│
├── backend/           # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── lib/             # Search, stats, meal-plan slot logic (+ tests)
│   │   ├── middleware/      # Auth middleware
│   │   └── index.ts
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── migrations/      # Applied automatically on container start
│   └── package.json
│
├── mcp/               # MCP server (Claude integration)
│   ├── src/
│   │   ├── api/             # REST client for the cookbook API
│   │   ├── oauth/           # OAuth server, Google sign-in page, session store
│   │   ├── tools/           # MCP tools (recipes, catalog, import)
│   │   ├── transport/       # stdio and streamable HTTP
│   │   └── index.ts
│   └── package.json
│
├── docker-compose.yml
└── .env
```

### Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS 4, shadcn/ui |
| Serving | nginx (static build + reverse proxy to backend and MCP server) |
| Backend | Node.js 22, Express, TypeScript, Prisma ORM, Sharp (image processing) |
| Database | PostgreSQL 16 (full-text search with `tsvector`) |
| MCP Server | Node.js, @modelcontextprotocol/sdk, Zod, Express, OAuth 2.1 + PKCE |
| Auth | JWT, bcrypt, Google OAuth 2.0, TOTP (2FA) |
| Tests | Vitest (backend, frontend, MCP server) |
| Container | Docker, Docker Compose |
| Mobile | Kotlin, Jetpack, Retrofit, Material Design 3 |

## 📅 Weekly Planner

The weekly planner allows you to plan meals for an entire week. The plan is
shared by all users of the instance.

**Features:**
- 📆 Week grid from Monday to Sunday with breakfast, lunch, and dinner
- 🍽️ Several dishes per meal (up to 6), e.g., main course, side, and dessert – each with its own serving count
- 🖱️ Drag & drop: pull a suggestion onto a slot, or move a single dish to another slot
- 💡 Suggestions sorted by how often you cooked them, leaving out recipes already planned this week
- 🧮 Automatic ingredient aggregation (same ingredients are summed up and scaled to the servings)
- 🛒 Shopping list with excludable ingredients, exportable to Gemini/Google Keep
- 🗓️ The week band at the bottom of the library shows what is planned for each evening

**How to use the weekly planner:**
1. Click "Week plan" in the header
2. Select the week with the arrows (or "This Week" / "Next Week")
3. Tap a free slot – or "+ Dish" in an occupied one – and pick a recipe from the suggestions, or drag a suggestion onto a slot
4. Adjust servings per dish with +/-, remove a dish with ×, drag a dish to move it
5. Click "Create shopping list" to review the ingredients and send them to Gemini

From a recipe's detail page, "Plan for a day" adds the recipe to any slot of any
week; occupied slots get the recipe as an additional dish.

## 📲 Android App

A native Android app is available as a mobile frontend. The source code is located in the separate repository/folder `cookbookApp`. The current build can be downloaded from the backend at `/api/app/download`.

**Android App Features:**
- 📱 Native Android experience
- 🔐 Login with username/password or Google SSO
- 📖 Browse, view, and edit recipes
- 📷 Take photos directly with the camera or add from gallery
- 👥 Serving calculator with automatic amount calculation
- 📁 Manage collections
- 🛒 Send ingredients to Gemini
- 🔄 Automatic network detection (internal/external)

The app still works with one dish per weekly-planner slot: it shows and edits
the first dish, and additional dishes planned in the web app are kept.

**Technology:**
- Kotlin
- Jetpack Components (ViewModel, Navigation)
- Retrofit + OkHttp
- Coil for image processing
- Material Design 3

## 📥 Recipe Import

Cookbook can automatically import recipes from various websites:

| Website | Status |
|---------|--------|
| Chefkoch.de | ✅ Full support |
| Kochbar.de | ✅ Full support |
| Zeit.de | ✅ Paywalled recipes with your own subscription (account menu → "Connect Zeit Subscription") |
| Others (JSON-LD) | ✅ Automatic |

The import uses structured data (JSON-LD/schema.org) and HTML parsing as fallback.

**How to import a recipe:**
1. Open the arrow next to "Add recipe" in the header and choose "Import from URL"
2. Paste the recipe URL
3. The recipe will be imported with images, ingredients, and instructions

## 🔧 Development

### Local Development

```bash
# Backend (http://localhost:4002, needs DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY)
cd backend
npm install
npx prisma migrate deploy
npm run dev

# Frontend (new terminal, http://localhost:3002)
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to `localhost:4002` and `/mcp` to
`localhost:4003` (see [frontend/vite.config.ts](frontend/vite.config.ts)).

### Tests and Type Checks

```bash
cd backend  && npm test            # unit tests; integration tests need TEST_DATABASE_URL
cd frontend && npm test && npm run typecheck
cd mcp      && npm test && npm run typecheck
```

### Database Changes

Schema changes go through Prisma migrations in `backend/prisma/migrations/`
(`npx prisma migrate dev --name <change>`). The `app` container applies new
migrations on its next start.

## 📝 API Documentation

Apart from login, `/api/health`, and the app download, all endpoints require an
`Authorization: Bearer <token>` header.

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Login with username/password (and 2FA code) |
| `/api/auth/google` | POST | Login with Google (existing users only) |
| `/api/auth/refresh` | POST | Renew a token (also shortly after expiry) |
| `/api/auth/register` | POST | Create a user (admin only) |
| `/api/auth/me` | GET | Current user |
| `/api/auth/change-password` | POST | Change password |
| `/api/auth/2fa/setup` | POST | Set up 2FA |
| `/api/auth/2fa/verify` | POST | Verify 2FA |
| `/api/auth/2fa/disable` | POST | Disable 2FA |
| `/api/auth/2fa/status` | GET | 2FA status |

### Recipes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/recipes` | GET | All recipes (with filter & pagination) |
| `/api/recipes/search?q=…` | GET | Full-text search, returns `{ "ids": [...] }` best matches first |
| `/api/recipes/:id` | GET | Single recipe |
| `/api/recipes` | POST | Create recipe |
| `/api/recipes/:id` | PUT | Edit recipe (replaces ingredients and categories completely) |
| `/api/recipes/:id` | DELETE | Delete recipe |
| `/api/recipes/:id/cooked` | POST | Record that the recipe was cooked (`{ "servings"?: number }`) |
| `/api/recipes/:id/favorite` | PUT/DELETE | Mark / unmark as favorite |
| `/api/import` | POST | Import recipe from URL |

Every recipe response contains the per-user fields `cookCount`, `lastCookedAt`,
and `isFavorite`.

**Query parameters for `/api/recipes`:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Filter by category |
| `collection` | string | Filter by collection ID |
| `search` | string | Full-text search over title, categories, ingredients, notes and instructions (PostgreSQL, German stemming, prefix matching; all words must occur), plus substring match in title and ingredient names ("Suppe" finds "Tomatensuppe") |
| `full` | boolean | `true` = complete recipe data (Web), `false` = thumbnails + basic info (Mobile) |
| `limit` | number | Number of recipes per page (only without `full=true`, max. 100) |
| `offset` | number | Offset for pagination (only without `full=true`) |

**Response formats:**

With `full=true` (Web app):
```json
[
  { "id": "...", "title": "...", "ingredients": [...], "instructions": "...", ... }
]
```

Without `full=true` (Mobile app, paginated):
```json
{
  "items": [{ "id": "...", "title": "...", "thumbnail": "...", ... }],
  "total": 42,
  "limit": 20,
  "offset": 0,
  "hasMore": true
}
```

### Weekly Planner

`:week` is the Monday of the week as `YYYY-MM-DD`. Slots are identified by
`dayIndex` (0 = Monday … 6 = Sunday) and `mealType` (`breakfast`, `lunch`,
`dinner`). A slot holds up to 6 dishes, ordered by `position`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mealplans/:week` | GET | Plan of the week; `meals` has one entry per dish |
| `/api/mealplans/:week` | PUT | Replace the whole week (`{ "meals": [...] }`) |
| `/api/mealplans/:week/slots` | PUT | Replace the dishes of one or more slots in one transaction |
| `/api/mealplans/:week/slot` | POST | Append one dish to a slot (409 if full or already planned there) |
| `/api/mealplans/:week/slot` | PATCH | Legacy (Android app): set or clear the first dish of a slot, other dishes are kept |
| `/api/mealplans/:week` | DELETE | Delete the plan of the week |
| `/api/mealplans/:week/sent-ingredients` | POST/DELETE | Mark ingredients as sent to Gemini / reset |
| `/api/mealplans/:week/excluded-ingredients` | POST/DELETE | Exclude ingredients from the shopping list / reset |
| `/api/mealplans/:week/excluded-ingredients/:name` | DELETE | Restore one excluded ingredient |

Example – move the dessert from Monday dinner to Tuesday lunch:

```json
PUT /api/mealplans/2026-09-28/slots
{
  "slots": [
    { "dayIndex": 0, "mealType": "dinner", "dishes": [{ "recipeId": "lasagne-id", "servings": 4 }] },
    { "dayIndex": 1, "mealType": "lunch",  "dishes": [{ "recipeId": "tiramisu-id", "servings": 4 }] }
  ]
}
```

### Collections, Categories, Users & Settings

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/collections` | GET/POST | List / create collections |
| `/api/collections/:id` | GET/PUT/DELETE | Single collection |
| `/api/collections/:id/recipes/:recipeId` | POST/DELETE | Add / remove recipe |
| `/api/categories` | GET/POST | List / create categories |
| `/api/categories/details` | GET | Categories with recipe counts |
| `/api/categories/:id`, `/api/categories/name/:name` | DELETE | Delete category |
| `/api/users` | GET/POST | List / create users (admin only) |
| `/api/users/:id` | PUT/DELETE | Edit / delete user (admin only) |
| `/api/users/me/zeit-cookie` | GET/PUT/DELETE | Own Zeit.de session cookie (stored encrypted) |
| `/api/settings/gemini-prompt` | GET/PUT | Prompt used for the Gemini shopping list export |

## 🤝 Contributing

Contributions are welcome! Please create a fork and a pull request.

1. Create a fork
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -m 'Added new feature'`)
4. Push branch (`git push origin feature/new-feature`)
5. Create pull request

## 📄 License

MIT License – see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) – UI components
- [Prisma](https://www.prisma.io/) – Database ORM
- [Lucide](https://lucide.dev/) – Icons
- [Sharp](https://sharp.pixelplumbing.com/) – Image processing & thumbnails
- [Retrofit](https://square.github.io/retrofit/) – HTTP client for Android

---

**Made with ❤️ for home cooks who value privacy**
