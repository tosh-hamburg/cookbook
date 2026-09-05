import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHttpApp } from './http.js';
import { OAuthStore } from '../oauth/store.js';
import { MCP_PATH } from '../oauth/urls.js';
import { createFetchStub, makeHttpConfig, makeJwt, makeRecipe, type RecordedCall } from '../test-utils.js';

/**
 * End-to-End-Test des OAuth-Ablaufs: Registrierung, Anmeldung mit Google,
 * Code-Tausch, Werkzeugaufruf, Token-Erneuerung und Widerruf.
 *
 * Nur die Kochbuch-API ist durch ein fetch-Double ersetzt; der HTTP-Server,
 * der OAuth-Provider und der MCP-Transport laufen echt.
 */

const CLIENT_REDIRECT = 'http://127.0.0.1:33418/callback';
const GOOGLE_CREDENTIAL = 'google-id-token';
/** Kochbuch-JWT, das das API-Double nach erfolgreichem Google-Login ausgibt. */
const COOKBOOK_JWT = makeJwt(7 * 24 * 3600);
const REFRESHED_JWT = makeJwt(7 * 24 * 3600 + 1);

let server: Server;
let baseUrl: string;
let dataDir: string;
let apiCalls: RecordedCall[];
/**
 * Die Client-Registrierung ist absichtlich auf 20 Aufrufe pro Stunde begrenzt.
 * In der Praxis registriert sich Claude genau einmal, deshalb teilen sich fast
 * alle Tests einen Client.
 */
let sharedClientId: string;

/** Sucht einen freien Port, damit die öffentliche URL vorab feststeht. */
async function findFreePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address() as { port: number };
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

beforeAll(async () => {
  const port = await findFreePort();
  baseUrl = `http://localhost:${port}`;
  dataDir = await mkdtemp(path.join(tmpdir(), 'cookbook-mcp-'));

  const stub = createFetchStub((call) => {
    if (call.url.pathname === '/api/auth/google') {
      const body = call.body as { credential?: string };
      if (body.credential !== GOOGLE_CREDENTIAL) {
        return { status: 401, body: { error: 'Kein Benutzerkonto mit dieser E-Mail-Adresse gefunden.' } };
      }
      return { body: { token: COOKBOOK_JWT, user: { id: 'u-1', username: 'thorsten', role: 'admin' } } };
    }
    if (call.url.pathname === '/api/auth/refresh') {
      return { body: { token: REFRESHED_JWT, user: { id: 'u-1', username: 'thorsten', role: 'admin' } } };
    }
    return { body: makeRecipe() };
  });
  apiCalls = stub.calls;

  const store = new OAuthStore(dataDir);
  await store.load();

  const { app } = createHttpApp({
    config: makeHttpConfig({ port, publicUrl: baseUrl }),
    endpoint: { apiUrl: 'https://api.example.test', timeoutMs: 5_000 },
    store,
    fetchImpl: stub.fetch,
  });

  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(port, '127.0.0.1', () => resolve(listening));
  });

  sharedClientId = await registerClient();
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(dataDir, { recursive: true, force: true });
});

// ------------------------------------------------------------- Hilfsmittel

async function registerClient(clientName = 'Claude Test'): Promise<string> {
  const response = await fetch(`${baseUrl}${MCP_PATH}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: clientName,
      redirect_uris: [CLIENT_REDIRECT],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  });
  expect(response.status).toBe(201);
  const client = (await response.json()) as { client_id: string };
  return client.client_id;
}

interface StartedLogin {
  ticket: string;
  /** Cookie-Kopfzeile, die den Anmeldevorgang an diesen "Browser" bindet. */
  cookie: string;
}

async function startAuthorization(clientId: string, challenge: string, state = 'xyz'): Promise<StartedLogin> {
  const url = new URL(`${baseUrl}${MCP_PATH}/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', CLIENT_REDIRECT);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);

  const response = await fetch(url, { redirect: 'manual' });
  expect(response.status).toBe(302);

  const location = new URL(response.headers.get('location') ?? '');
  const ticket = location.searchParams.get('ticket');
  expect(ticket).toBeTruthy();

  const setCookie = response.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(';')[0];
  expect(cookie).toContain('cookbook_mcp_login=');

  return { ticket: ticket as string, cookie };
}

function loginStep(step: string, cookie: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${baseUrl}${MCP_PATH}/login/${step}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
}

function verifyLogin(login: StartedLogin, credential = GOOGLE_CREDENTIAL): Promise<Response> {
  return loginStep('verify', login.cookie, { ticket: login.ticket, credential });
}

function approveLogin(login: StartedLogin): Promise<Response> {
  return loginStep('approve', login.cookie, { ticket: login.ticket });
}

function denyLogin(login: StartedLogin): Promise<Response> {
  return loginStep('deny', login.cookie, { ticket: login.ticket });
}

function exchangeCode(clientId: string, code: string, verifier: string): Promise<Response> {
  return fetch(`${baseUrl}${MCP_PATH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      client_id: clientId,
      redirect_uri: CLIENT_REDIRECT,
    }),
  });
}

async function codeFor(clientId: string, challenge: string, state = 'xyz'): Promise<string> {
  const login = await startAuthorization(clientId, challenge, state);
  expect((await verifyLogin(login)).status).toBe(200);
  const approved = await approveLogin(login);
  expect(approved.status).toBe(200);
  const { redirect } = (await approved.json()) as { redirect: string };
  return new URL(redirect).searchParams.get('code') as string;
}

/** Läuft den kompletten Ablauf durch und liefert die ausgestellten Token. */
async function authorizeFully(): Promise<{ clientId: string; accessToken: string; refreshToken: string }> {
  const clientId = sharedClientId;
  const { verifier, challenge } = pkce();
  const code = await codeFor(clientId, challenge);

  const tokenResponse = await exchangeCode(clientId, code, verifier);
  expect(tokenResponse.status).toBe(200);
  const tokens = (await tokenResponse.json()) as { access_token: string; refresh_token: string };

  return { clientId, accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
}

function mcpRequest(body: unknown, accessToken?: string): Promise<Response> {
  return fetch(`${baseUrl}${MCP_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const initializeBody = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } },
};

// ------------------------------------------------------------------ Tests

describe('Auffindbarkeit', () => {
  test('nennt die geschützte Ressource unter dem pfadbezogenen well-known-Dokument', async () => {
    const response = await fetch(`${baseUrl}/.well-known/oauth-protected-resource${MCP_PATH}`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      resource: `${baseUrl}${MCP_PATH}`,
      authorization_servers: [baseUrl],
    });
  });

  test('liefert die Metadaten des Autorisierungsservers im Root', async () => {
    const response = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}${MCP_PATH}/authorize`,
      token_endpoint: `${baseUrl}${MCP_PATH}/token`,
      registration_endpoint: `${baseUrl}${MCP_PATH}/register`,
      code_challenge_methods_supported: ['S256'],
    });
  });

  test('liefert die Server-Metadaten auch unter der pfadbezogenen Adresse', async () => {
    const response = await fetch(`${baseUrl}/.well-known/oauth-authorization-server${MCP_PATH}`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ issuer: baseUrl });
  });

  test('liefert die Ressourcen-Metadaten auch im Root', async () => {
    const response = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ resource: `${baseUrl}${MCP_PATH}` });
  });

  test('hängt alle OAuth-Endpunkte unter /mcp ein, nicht in den Root', async () => {
    // Sonst kollidierten sie mit den Routen der Website auf derselben Domain.
    const response = await fetch(`${baseUrl}/authorize`, { redirect: 'manual' });

    expect(response.status).toBe(404);
  });

  test('weist unangemeldete Anfragen mit dem Verweis auf die Metadaten ab', async () => {
    const response = await mcpRequest(initializeBody);

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain(
      `resource_metadata="${baseUrl}/.well-known/oauth-protected-resource${MCP_PATH}"`,
    );
  });

  test('beantwortet den Health-Check ohne Anmeldung', async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'ok', server: 'cookbook-mcp' });
  });
});

describe('Anmeldeseite', () => {
  test('zeigt den Google-Knopf mit der Client-ID der Website', async () => {
    const clientId = sharedClientId;
    const login = await startAuthorization(clientId, pkce().challenge);

    const response = await fetch(`${baseUrl}${MCP_PATH}/login?ticket=${login.ticket}`, {
      headers: { Cookie: login.cookie },
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('content-security-policy')).toContain('frame-ancestors');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(html).toContain('1234567890-test.apps.googleusercontent.com');
    expect(html).toContain('accounts.google.com/gsi/client');
    expect(html).toContain('Claude Test');
  });

  test('maskiert den Namen des Clients', async () => {
    const clientId = await registerClient('<script>alert(1)</script>');
    const login = await startAuthorization(clientId, pkce().challenge);

    const html = await (
      await fetch(`${baseUrl}${MCP_PATH}/login?ticket=${login.ticket}`, { headers: { Cookie: login.cookie } })
    ).text();

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  test('lehnt ein unbekanntes Ticket ab', async () => {
    const response = await fetch(`${baseUrl}${MCP_PATH}/login?ticket=gibtsnicht`);

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('abgelaufen');
  });

  test('lehnt ein Google-Konto ohne Kochbuch-Benutzer ab', async () => {
    const clientId = sharedClientId;
    const login = await startAuthorization(clientId, pkce().challenge);

    const response = await verifyLogin(login, 'fremdes-token');

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: 'access_denied' });
  });

  test('verbraucht ein Ticket nur einmal', async () => {
    const clientId = sharedClientId;
    const login = await startAuthorization(clientId, pkce().challenge);
    await verifyLogin(login);

    expect((await approveLogin(login)).status).toBe(200);
    expect((await approveLogin(login)).status).toBe(400);
  });

  test('zeigt die Seite nicht ohne das Bindungs-Cookie', async () => {
    // Schutz gegen weitergeleitete Anmeldelinks.
    const clientId = sharedClientId;
    const login = await startAuthorization(clientId, pkce().challenge);

    const response = await fetch(`${baseUrl}${MCP_PATH}/login?ticket=${login.ticket}`);

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('anderen Browser');
  });

  test('lehnt eine Anmeldung ohne das Bindungs-Cookie ab', async () => {
    const clientId = sharedClientId;
    const login = await startAuthorization(clientId, pkce().challenge);

    const response = await loginStep('verify', '', { ticket: login.ticket, credential: GOOGLE_CREDENTIAL });

    expect(response.status).toBe(400);
  });
});

describe('Einwilligung', () => {
  test('stellt erst nach ausdrücklicher Zustimmung einen Code aus', async () => {
    const clientId = sharedClientId;
    const login = await startAuthorization(clientId, pkce().challenge);

    const verified = await verifyLogin(login);
    expect(verified.status).toBe(200);
    await expect(verified.json()).resolves.toEqual({
      username: 'thorsten',
      clientName: 'Claude Test',
      redirectHost: '127.0.0.1:33418',
    });

    const approved = await approveLogin(login);
    const { redirect } = (await approved.json()) as { redirect: string };
    expect(new URL(redirect).searchParams.get('code')).toBeTruthy();
  });

  test('gibt ohne vorherige Google-Anmeldung keinen Code aus', async () => {
    const clientId = sharedClientId;
    const login = await startAuthorization(clientId, pkce().challenge);

    const response = await approveLogin(login);

    expect(response.status).toBe(400);
  });

  test('meldet eine Ablehnung als access_denied an den Client', async () => {
    const clientId = sharedClientId;
    const login = await startAuthorization(clientId, pkce().challenge);
    await verifyLogin(login);

    const denied = await denyLogin(login);

    expect(denied.status).toBe(200);
    const { redirect } = (await denied.json()) as { redirect: string };
    const target = new URL(redirect);
    expect(target.searchParams.get('error')).toBe('access_denied');
    expect(target.searchParams.get('code')).toBeNull();
  });
});

describe('Code-Tausch', () => {
  test('liefert Access- und Refresh-Token', async () => {
    const { accessToken, refreshToken } = await authorizeFully();

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  test('gibt den state unverändert zurück', async () => {
    const clientId = sharedClientId;
    const login = await startAuthorization(clientId, pkce().challenge, 'mein-state');
    await verifyLogin(login);

    const { redirect } = (await (await approveLogin(login)).json()) as { redirect: string };

    expect(new URL(redirect).searchParams.get('state')).toBe('mein-state');
  });

  test('weist einen falschen code_verifier ab', async () => {
    const clientId = sharedClientId;
    const { challenge } = pkce();
    const code = await codeFor(clientId, challenge);

    const response = await exchangeCode(clientId, code, pkce().verifier);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_grant' });
  });

  test('lässt einen Code nur ein einziges Mal einlösen', async () => {
    const clientId = sharedClientId;
    const { verifier, challenge } = pkce();
    const code = await codeFor(clientId, challenge);

    expect((await exchangeCode(clientId, code, verifier)).status).toBe(200);
    expect((await exchangeCode(clientId, code, verifier)).status).toBe(400);
  });

  test('lehnt die Registrierung mit fremder Rücksprungadresse ab', async () => {
    // Sonst könnte sich jemand einen Client bauen, der Codes auf seinen
    // eigenen Server umleitet.
    const response = await fetch(`${baseUrl}${MCP_PATH}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Boeser Client',
        redirect_uris: ['https://boeser.example/klau'],
        token_endpoint_auth_method: 'none',
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_client_metadata' });
  });

  test('lehnt einen nicht registrierten redirect_uri ab', async () => {
    const clientId = sharedClientId;
    const url = new URL(`${baseUrl}${MCP_PATH}/authorize`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', 'https://boeser.example/klau');
    url.searchParams.set('code_challenge', pkce().challenge);
    url.searchParams.set('code_challenge_method', 'S256');

    const response = await fetch(url, { redirect: 'manual' });

    expect(response.status).toBe(400);
  });
});

describe('Werkzeugaufrufe unter der angemeldeten Identität', () => {
  test('lässt angemeldete Anfragen durch', async () => {
    const { accessToken } = await authorizeFully();

    const response = await mcpRequest(initializeBody, accessToken);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('cookbook');
  });

  test('ruft die Kochbuch-API mit dem Token der angemeldeten Person auf', async () => {
    const { accessToken } = await authorizeFully();
    const before = apiCalls.length;

    await (
      await mcpRequest(
        { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_recipe', arguments: { id: 'r-1' } } },
        accessToken,
      )
    ).text();

    const recipeCall = apiCalls.slice(before).find((call) => call.url.pathname.startsWith('/api/recipes'));
    expect(recipeCall).toBeDefined();
    // Der Kern des Ganzen: An die API geht das JWT der angemeldeten Person,
    // nicht das eines gemeinsamen Dienstkontos.
    expect(recipeCall?.headers.authorization).toBe(`Bearer ${COOKBOOK_JWT}`);
  });

  test('antwortet als JSON, nicht als SSE-Strom', async () => {
    // Geht durch den Vite-Proxy des Frontends; JSON ist dort unkritischer.
    const { accessToken } = await authorizeFully();

    const response = await mcpRequest(initializeBody, accessToken);

    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toMatchObject({
      result: { serverInfo: { name: 'cookbook' } },
    });
  });

  test('weist ein erfundenes Token ab', async () => {
    const response = await mcpRequest(initializeBody, 'ausgedacht');

    expect(response.status).toBe(401);
  });
});

describe('Token-Erneuerung und Widerruf', () => {
  function refresh(clientId: string, refreshToken: string): Promise<Response> {
    return fetch(`${baseUrl}${MCP_PATH}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId }),
    });
  }

  test('erneuert Access-Token und Kochbuch-Sitzung', async () => {
    const { clientId, refreshToken } = await authorizeFully();
    const before = apiCalls.length;

    const response = await refresh(clientId, refreshToken);

    expect(response.status).toBe(200);
    const tokens = (await response.json()) as { access_token: string };
    expect(tokens.access_token).toBeTruthy();
    // Das Kochbuch-JWT gilt nur sieben Tage — bei jeder Erneuerung wird es
    // mit aufgefrischt, sonst wäre die Sitzung nach einer Woche wertlos.
    expect(apiCalls.slice(before).some((call) => call.url.pathname === '/api/auth/refresh')).toBe(true);
  });

  test('entwertet das alte Access-Token nach der Erneuerung', async () => {
    const { clientId, accessToken, refreshToken } = await authorizeFully();

    await refresh(clientId, refreshToken);

    expect((await mcpRequest(initializeBody, accessToken)).status).toBe(401);
  });

  test('weist ein unbekanntes Refresh-Token ab', async () => {
    const { clientId } = await authorizeFully();

    const response = await refresh(clientId, 'ausgedacht');

    expect(response.status).toBe(400);
  });

  test('beendet die Sitzung beim Widerruf', async () => {
    const { clientId, accessToken } = await authorizeFully();

    const revoked = await fetch(`${baseUrl}${MCP_PATH}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: accessToken, client_id: clientId }),
    });

    expect(revoked.status).toBe(200);
    expect((await mcpRequest(initializeBody, accessToken)).status).toBe(401);
  });
});

describe('Endpunkt-Verhalten', () => {
  test('setzt nosniff auf jede Antwort', async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  test('lehnt GET auf /mcp ab, weil der Server zustandslos arbeitet', async () => {
    const { accessToken } = await authorizeFully();

    const response = await fetch(`${baseUrl}${MCP_PATH}`, { headers: { Authorization: `Bearer ${accessToken}` } });

    expect(response.status).toBe(405);
  });

  test('lehnt DELETE auf /mcp ab', async () => {
    const { accessToken } = await authorizeFully();

    const response = await fetch(`${baseUrl}${MCP_PATH}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status).toBe(405);
  });

  test('vergibt keine Sitzungs-ID', async () => {
    const { accessToken } = await authorizeFully();

    const response = await mcpRequest(initializeBody, accessToken);
    await response.text();

    expect(response.headers.get('mcp-session-id')).toBeNull();
  });
});
