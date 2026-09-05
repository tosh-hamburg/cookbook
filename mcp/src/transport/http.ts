import type { Server } from 'node:http';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import type { ClientResolver } from '../client-resolver.js';
import { sessionClientResolver } from '../client-resolver.js';
import type { HttpConfig } from '../config.js';
import { createMcpServer } from '../server.js';
import { CookbookOAuthProvider } from '../oauth/provider.js';
import { createOAuthRouter } from '../oauth/router.js';
import type { OAuthStore } from '../oauth/store.js';
import { buildPublicUrls, MCP_PATH, type PublicUrls } from '../oauth/urls.js';
import type { ApiEndpoint, Fetch } from '../api/client.js';

/**
 * Maximale Größe einer JSON-RPC-Anfrage.
 *
 * Muss über den Bildgrenzen in `schemas/recipe.ts` liegen: Dort werden zu große
 * Bilder mit einer verständlichen Meldung abgelehnt, hier gäbe es nur ein 413.
 */
const BODY_LIMIT = '4mb';

/** Obergrenze gegen Missbrauch der Werkzeuge. */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;

/** Zeitgrenzen gegen langsam gehaltene Verbindungen (Slowloris). */
const HEADERS_TIMEOUT_MS = 20_000;
const REQUEST_TIMEOUT_MS = 120_000;
const KEEP_ALIVE_TIMEOUT_MS = 15_000;

/** Wie oft abgelaufene Anmeldungen, Codes und Sitzungen weggeräumt werden. */
const PURGE_INTERVAL_MS = 60 * 60 * 1000;

const JSONRPC_METHOD_NOT_ALLOWED = {
  jsonrpc: '2.0' as const,
  error: { code: -32000, message: 'Method not allowed. Dieser Server arbeitet zustandslos; nur POST wird unterstützt.' },
  id: null,
};

export interface HttpServerOptions {
  config: HttpConfig;
  endpoint: ApiEndpoint;
  store: OAuthStore;
  fetchImpl?: Fetch;
}

export interface HttpApp {
  app: Express;
  urls: PublicUrls;
  provider: CookbookOAuthProvider;
}

/**
 * Baut die Express-App für den Streamable-HTTP-Transport samt OAuth.
 *
 * Der MCP-Server arbeitet zustandslos: pro Anfrage entstehen eine frische
 * MCP-Server- und Transport-Instanz. Die Anmeldung dagegen ist zustandsbehaftet
 * und liegt im {@link OAuthStore} auf der Platte, damit ein Neustart des
 * Containers niemanden abmeldet.
 */
export function createHttpApp(options: HttpServerOptions): HttpApp {
  const { config, endpoint, store } = options;
  const urls = buildPublicUrls(config.publicUrl);

  const provider = new CookbookOAuthProvider({
    store,
    endpoint,
    urls,
    allowedRedirectOrigins: config.allowedRedirectOrigins,
    fetchImpl: options.fetchImpl,
  });
  const resolveClient: ClientResolver = sessionClientResolver({ endpoint, store, fetchImpl: options.fetchImpl });

  const app = express();
  app.disable('x-powered-by');
  // Läuft hinter dem Vite-Proxy des Frontends und dem Synology-Reverse-Proxy;
  // nur lokalen Proxys vertrauen, damit X-Forwarded-For nicht gefälscht wird.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');

  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: 'cookbook-mcp', timestamp: new Date().toISOString() });
  });

  // OAuth-Metadaten, Anmeldeseite und die Endpunkte für Registrierung,
  // Autorisierung, Token und Widerruf.
  app.use(createOAuthRouter({ provider, store, urls, googleClientId: config.googleClientId }));

  const limiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    limit: RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: { jsonrpc: '2.0', error: { code: -32002, message: 'Zu viele Anfragen' }, id: null },
  });

  const authenticate = requireBearerAuth({
    verifier: provider,
    resourceMetadataUrl: urls.protectedResourceMetadataUrl,
  });

  // Genauer Pfad, kein app.use-Präfix: Sonst lägen auch /mcp/authorize und
  // /mcp/login hinter der Token-Prüfung — und niemand käme je zur Anmeldung.
  app.post(MCP_PATH, limiter, authenticate, express.json({ limit: BODY_LIMIT }), async (req, res) => {
    const server = createMcpServer(resolveClient);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      // Reine JSON-Antworten statt SSE: Der Server schickt von sich aus keine
      // Nachrichten, und JSON übersteht den Vite-Proxy des Frontends und den
      // Reverse Proxy ohne Pufferungs-Überraschungen.
      enableJsonResponse: true,
    });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('MCP-Anfrage fehlgeschlagen:', error instanceof Error ? error.message : String(error));
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Interner Serverfehler' },
          id: null,
        });
      }
    }
  });

  app.get(MCP_PATH, (_req, res) => res.status(405).json(JSONRPC_METHOD_NOT_ALLOWED));
  app.delete(MCP_PATH, (_req, res) => res.status(405).json(JSONRPC_METHOD_NOT_ALLOWED));

  return { app, urls, provider };
}

/** Startet den HTTP-Transport und liefert den laufenden Node-Server zurück. */
export async function startHttpServer(options: HttpServerOptions): Promise<Server> {
  const { app, urls } = createHttpApp(options);
  const { config, store } = options;

  const purgeTimer = setInterval(() => {
    void store
      .purgeExpired()
      .then((removed) => {
        if (removed > 0) {
          console.error(`OAuth-Speicher aufgeräumt: ${removed} abgelaufene Einträge entfernt`);
        }
      })
      .catch((error: unknown) => {
        console.error('Aufräumen fehlgeschlagen:', error instanceof Error ? error.message : error);
      });
  }, PURGE_INTERVAL_MS);
  purgeTimer.unref();

  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, config.host, () => {
      console.error(`cookbook-mcp lauscht auf http://${config.host}:${config.port}${MCP_PATH}`);
      console.error(`öffentlich erreichbar unter ${urls.resource}`);
      resolve(server);
    });
    server.headersTimeout = HEADERS_TIMEOUT_MS;
    server.requestTimeout = REQUEST_TIMEOUT_MS;
    server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
    server.on('error', reject);
  });
}
