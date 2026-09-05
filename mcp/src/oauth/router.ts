import express, { type Request, type Response, type Router } from 'express';
import { randomBytes } from 'node:crypto';
import { authorizationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/authorize.js';
import { clientRegistrationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/register.js';
import { metadataHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/metadata.js';
import { revocationHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/revoke.js';
import { tokenHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/token.js';
import { OAuthError, ServerError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthMetadata, OAuthProtectedResourceMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import { z } from 'zod';
import { BINDING_COOKIE, type CookbookOAuthProvider } from './provider.js';
import type { OAuthStore } from './store.js';
import { loginPageCsp, renderErrorPage, renderLoginPage } from './login-page.js';
import { MCP_PATH, type PublicUrls } from './urls.js';

/**
 * Baut den OAuth-Teil der Express-App.
 *
 * Die SDK-Funktion `mcpAuthRouter` hängt ihre Endpunkte fest an den Root
 * (`/authorize`, `/token`, …). Weil der Server hier unter `/mcp` auf derselben
 * Domain wie die Website läuft, würden diese Namen mit den Routen des Frontends
 * kollidieren. Deshalb werden die einzelnen SDK-Handler hier selbst unter
 * `/mcp/...` eingehängt und die Metadaten-Dokumente passend dazu gebaut.
 *
 * Die beiden `.well-known`-Dokumente bleiben im Root, weil RFC 8414 und
 * RFC 9728 sie dort verlangen.
 */

const LOGIN_PATH = `${MCP_PATH}/login`;

const ticketSchema = z.object({ ticket: z.string().min(1) });
const verifySchema = ticketSchema.extend({ credential: z.string().min(1) });

export interface OAuthRouterOptions {
  provider: CookbookOAuthProvider;
  store: OAuthStore;
  urls: PublicUrls;
  googleClientId: string;
  resourceName?: string;
}

export function buildAuthorizationServerMetadata(urls: PublicUrls): OAuthMetadata {
  return {
    issuer: urls.issuer,
    authorization_endpoint: urls.authorizationEndpoint,
    token_endpoint: urls.tokenEndpoint,
    registration_endpoint: urls.registrationEndpoint,
    revocation_endpoint: urls.revocationEndpoint,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    revocation_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
  };
}

export function buildProtectedResourceMetadata(
  urls: PublicUrls,
  resourceName: string,
): OAuthProtectedResourceMetadata {
  return {
    resource: urls.resource,
    authorization_servers: [urls.issuer],
    resource_name: resourceName,
  };
}

/** Liest einen Cookie-Wert aus dem Request-Header (ohne zusätzliche Abhängigkeit). */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return undefined;
}

export function createOAuthRouter(options: OAuthRouterOptions): Router {
  const { provider, store, urls, googleClientId } = options;
  const resourceName = options.resourceName ?? 'Kochbuch';
  const router = express.Router();

  const asMetadata = buildAuthorizationServerMetadata(urls);
  const prMetadata = buildProtectedResourceMetadata(urls, resourceName);

  // Beide Schreibweisen bedienen: RFC 9728 verlangt die pfadbezogene Variante
  // (.../oauth-protected-resource/mcp), ältere Clients fragen im Root an.
  // metadataHandler beantwortet nur exakt seinen Mount-Pfad, deshalb muss jede
  // Variante einzeln eingehängt werden — ein Präfix-Mount reicht nicht.
  for (const suffix of [MCP_PATH, '']) {
    router.use(`/.well-known/oauth-authorization-server${suffix}`, metadataHandler(asMetadata));
    router.use(`/.well-known/oauth-protected-resource${suffix}`, metadataHandler(prMetadata));
  }

  router.use(`${MCP_PATH}/authorize`, authorizationHandler({ provider }));
  router.use(`${MCP_PATH}/token`, tokenHandler({ provider }));
  router.use(`${MCP_PATH}/register`, clientRegistrationHandler({ clientsStore: provider.clientsStore }));
  router.use(`${MCP_PATH}/revoke`, revocationHandler({ provider }));

  // ------------------------------------------------------------ Anmeldung

  router.get(LOGIN_PATH, (req, res) => {
    setLoginHeaders(res);
    res.type('html');

    const ticket = typeof req.query.ticket === 'string' ? req.query.ticket : '';
    const binding = readCookie(req.headers.cookie, BINDING_COOKIE);

    let pending;
    try {
      pending = provider.requirePendingLogin(ticket, binding);
    } catch (error) {
      const message =
        error instanceof OAuthError
          ? error.message
          : 'Dieser Anmeldelink ist nicht mehr gültig. Bitte starte die Verbindung in Claude noch einmal.';
      res.status(400).send(renderErrorPage('Anmeldung nicht möglich', message));
      return;
    }

    const nonce = randomBytes(16).toString('base64');
    res.setHeader('Content-Security-Policy', loginPageCsp(nonce));

    const client = store.getClient(pending.clientId);
    res.status(200).send(
      renderLoginPage({
        ticket,
        googleClientId,
        loginPath: LOGIN_PATH,
        clientName: client?.client_name,
        nonce,
      }),
    );
  });

  const json = express.json({ limit: '64kb' });

  router.post(`${LOGIN_PATH}/verify`, json, (req, res) => {
    void handleLoginStep(req, res, (ticket, binding) => {
      const parsed = verifySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ServerError('Google-Token fehlt');
      }
      return provider.verifyLogin(ticket, binding, parsed.data.credential);
    });
  });

  router.post(`${LOGIN_PATH}/approve`, json, (req, res) => {
    void handleLoginStep(req, res, async (ticket, binding) => ({
      redirect: await provider.approveLogin(ticket, binding),
    }));
  });

  router.post(`${LOGIN_PATH}/deny`, json, (req, res) => {
    void handleLoginStep(req, res, async (ticket, binding) => ({
      redirect: await provider.denyLogin(ticket, binding),
    }));
  });

  return router;
}

function setLoginHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  // Das Ticket steht in der URL — es darf nicht als Referrer nach außen gehen.
  res.setHeader('Referrer-Policy', 'no-referrer');
}

/**
 * Gemeinsamer Rahmen der drei Anmeldeschritte: Ticket lesen, Browser-Bindung
 * durchreichen, Fehler in OAuth-Antworten übersetzen.
 */
async function handleLoginStep(
  req: Request,
  res: Response,
  run: (ticket: string, binding: string | undefined) => Promise<unknown>,
): Promise<void> {
  setLoginHeaders(res);

  const parsed = ticketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request', error_description: 'Ticket fehlt' });
    return;
  }

  try {
    res.status(200).json(await run(parsed.data.ticket, readCookie(req.headers.cookie, BINDING_COOKIE)));
  } catch (error) {
    const oauthError = error instanceof OAuthError ? error : new ServerError('Interner Serverfehler');
    // 403 macht in der Oberfläche klarer, dass das Google-Konto zwar echt ist,
    // aber zu keinem Kochbuch-Benutzer gehört.
    const status =
      oauthError.errorCode === 'access_denied' ? 403 : oauthError.errorCode === 'server_error' ? 500 : 400;
    if (!(error instanceof OAuthError)) {
      console.error('Anmeldung fehlgeschlagen:', error instanceof Error ? error.message : String(error));
    }
    res.status(status).json(oauthError.toResponseObject());
  }
}
