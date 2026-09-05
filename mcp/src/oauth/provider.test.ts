import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Response } from 'express';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import {
  ACCESS_TOKEN_TTL_MS,
  CookbookOAuthProvider,
  isAllowedRedirectUri,
  REFRESH_TOKEN_TTL_MS,
} from './provider.js';
import { hashToken, OAuthStore, randomToken } from './store.js';
import { buildPublicUrls } from './urls.js';
import { createFetchStub, makeJwt, type StubHandler } from '../test-utils.js';

/**
 * Randfälle des OAuth-Providers, die sich über den HTTP-Weg schlecht
 * herbeiführen lassen: abgelaufene Token, verweigerte Erneuerung, fremde
 * Clients, fehlende Browser-Bindung.
 */

const urls = buildPublicUrls('https://kochbuch.example.test');
const ALLOWED_ORIGINS = ['https://claude.ai'];
const client: OAuthClientInformationFull = {
  client_id: 'c-1',
  client_name: 'Claude Test',
  redirect_uris: ['http://127.0.0.1:9999/cb'],
};

let dir: string;
let store: OAuthStore;
let now: number;

const defaultHandler: StubHandler = (call) => {
  if (call.url.pathname === '/api/auth/google') {
    return { body: { token: makeJwt(3600), user: { id: 'u-1', username: 'thorsten', role: 'user' } } };
  }
  if (call.url.pathname === '/api/auth/refresh') {
    return { body: { token: makeJwt(3600), user: { id: 'u-1', username: 'thorsten', role: 'user' } } };
  }
  return { body: {} };
};

function makeProvider(handler: StubHandler = defaultHandler): CookbookOAuthProvider {
  const { fetch } = createFetchStub(handler);
  return new CookbookOAuthProvider({
    store,
    endpoint: { apiUrl: 'https://api.example.test', timeoutMs: 5_000 },
    urls,
    allowedRedirectOrigins: ALLOWED_ORIGINS,
    fetchImpl: fetch,
    now: () => now,
  });
}

/** Minimaler Ersatz für das Express-Response-Objekt: merkt sich Cookie und Ziel. */
function fakeResponse() {
  const state: { redirectedTo?: string; cookies: Record<string, string> } = { cookies: {} };
  const res = {
    cookie(name: string, value: string) {
      state.cookies[name] = value;
      return res;
    },
    redirect(_status: number, url: string) {
      state.redirectedTo = url;
    },
  } as unknown as Response;
  return { res, state };
}

/** Startet die Autorisierung und liefert Ticket samt Browser-Bindung. */
async function startLogin(provider: CookbookOAuthProvider, state = 'xyz') {
  await store.saveClient(client);
  const { res, state: captured } = fakeResponse();
  await provider.authorize(
    client,
    { codeChallenge: 'challenge', redirectUri: client.redirect_uris[0], state },
    res,
  );
  const ticket = new URL(captured.redirectedTo ?? '').searchParams.get('ticket') as string;
  return { ticket, binding: captured.cookies.cookbook_mcp_login, redirectedTo: captured.redirectedTo };
}

/** Führt Autorisierung, Anmeldung und Einwilligung durch und liefert die Token. */
async function fullyAuthorize(provider: CookbookOAuthProvider) {
  const { ticket, binding } = await startLogin(provider);
  await provider.verifyLogin(ticket, binding, 'google-token');
  const redirect = await provider.approveLogin(ticket, binding);
  const code = new URL(redirect).searchParams.get('code') as string;
  return provider.exchangeAuthorizationCode(client, code, undefined, client.redirect_uris[0]);
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'cookbook-provider-'));
  now = Date.now();
  // Dieselbe Zeitquelle wie der Provider, sonst laufen die Ablaufprüfungen
  // von Speicher und Provider auseinander.
  store = new OAuthStore(dir, () => now);
  await store.load();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('isAllowedRedirectUri', () => {
  test.each([
    'http://127.0.0.1:33418/callback',
    'http://localhost:9999/cb',
    'http://[::1]:1234/cb',
    'https://claude.ai/api/mcp/auth_callback',
  ])('lässt %s zu', (uri) => {
    expect(isAllowedRedirectUri(uri, ALLOWED_ORIGINS)).toBe(true);
  });

  test.each([
    'https://boeser.example/klau',
    'http://boeser.example/klau',
    'https://claude.ai.boeser.example/klau',
    'javascript:alert(1)',
    'keine-url',
  ])('blockt %s', (uri) => {
    expect(isAllowedRedirectUri(uri, ALLOWED_ORIGINS)).toBe(false);
  });
});

describe('Client-Registrierung', () => {
  test('lehnt eine fremde Rücksprungadresse ab', async () => {
    // Sonst könnte sich jemand einen Client registrieren, der Codes auf seinen
    // eigenen Server umleitet.
    const provider = makeProvider();

    await expect(
      provider.clientsStore.registerClient?.({ ...client, redirect_uris: ['https://boeser.example/klau'] }),
    ).rejects.toMatchObject({ errorCode: 'invalid_client_metadata' });
    expect(store.counts().clients).toBe(0);
  });

  test('speichert einen Client mit Loopback-Adresse', async () => {
    const provider = makeProvider();

    await provider.clientsStore.registerClient?.(client);

    expect(await provider.clientsStore.getClient('c-1')).toMatchObject({ client_id: 'c-1' });
  });
});

describe('authorize', () => {
  test('leitet auf die Anmeldeseite weiter und setzt die Browser-Bindung', async () => {
    const provider = makeProvider();

    const { ticket, binding, redirectedTo } = await startLogin(provider);

    expect(redirectedTo?.startsWith(urls.loginPage)).toBe(true);
    expect(ticket).toBeTruthy();
    expect(binding).toBeTruthy();
    expect(store.peekPendingLogin(ticket)?.browserBindingHash).toBe(hashToken(binding));
  });

  test('lehnt eine unzulässige Rücksprungadresse ab, auch wenn sie registriert ist', async () => {
    const provider = makeProvider();
    const boese = { ...client, redirect_uris: ['https://boeser.example/klau'] };
    await store.saveClient(boese);
    const { res } = fakeResponse();

    await expect(
      provider.authorize(boese, { codeChallenge: 'c', redirectUri: boese.redirect_uris[0] }, res),
    ).rejects.toThrow(/nicht zugelassen/);
  });
});

describe('Browser-Bindung', () => {
  test('lehnt eine Anmeldung aus einem anderen Browser ab', async () => {
    // Das ist der Schutz gegen weitergeleitete Anmeldelinks: Wer das Ticket
    // hat, aber nicht das Cookie, kommt nicht weiter.
    const provider = makeProvider();
    const { ticket } = await startLogin(provider);

    await expect(provider.verifyLogin(ticket, randomToken(), 'google-token')).rejects.toThrow(
      /anderen Browser/,
    );
  });

  test('lehnt eine Anmeldung ganz ohne Cookie ab', async () => {
    const provider = makeProvider();
    const { ticket } = await startLogin(provider);

    await expect(provider.verifyLogin(ticket, undefined, 'google-token')).rejects.toThrow(/anderen Browser/);
  });

  test('lehnt die Einwilligung aus einem anderen Browser ab', async () => {
    const provider = makeProvider();
    const { ticket, binding } = await startLogin(provider);
    await provider.verifyLogin(ticket, binding, 'google-token');

    await expect(provider.approveLogin(ticket, randomToken())).rejects.toThrow(/anderen Browser/);
  });
});

describe('verifyLogin', () => {
  test('nennt Konto, Anwendung und Ziel für die Einwilligung', async () => {
    const provider = makeProvider();
    const { ticket, binding } = await startLogin(provider);

    const details = await provider.verifyLogin(ticket, binding, 'google-token');

    expect(details).toEqual({ username: 'thorsten', clientName: 'Claude Test', redirectHost: '127.0.0.1:9999' });
  });

  test('erzeugt noch keinen Autorisierungscode', async () => {
    // Erst die Einwilligung darf einen Code ausstellen.
    const provider = makeProvider();
    const { ticket, binding } = await startLogin(provider);

    await provider.verifyLogin(ticket, binding, 'google-token');

    expect(store.counts().authorizationCodes).toBe(0);
  });

  test('verbraucht das Ticket bei einem Backend-Fehler nicht', async () => {
    // Sonst kostet ein Netzwerkhänger den kompletten Anmeldevorgang.
    let kaputt = true;
    const provider = makeProvider((call) => {
      if (call.url.pathname === '/api/auth/google') {
        return kaputt
          ? { status: 500, body: { error: 'kaputt' } }
          : { body: { token: makeJwt(3600), user: { id: 'u-1', username: 'thorsten', role: 'user' } } };
      }
      return { body: {} };
    });
    const { ticket, binding } = await startLogin(provider);

    await expect(provider.verifyLogin(ticket, binding, 'google-token')).rejects.toMatchObject({
      errorCode: 'server_error',
    });

    kaputt = false;
    await expect(provider.verifyLogin(ticket, binding, 'google-token')).resolves.toMatchObject({
      username: 'thorsten',
    });
  });

  test('lehnt ein Google-Konto ohne Kochbuch-Benutzer ab', async () => {
    const provider = makeProvider((call) =>
      call.url.pathname === '/api/auth/google' ? { status: 401, body: { error: 'Kein Benutzerkonto' } } : { body: {} },
    );
    const { ticket, binding } = await startLogin(provider);

    await expect(provider.verifyLogin(ticket, binding, 'google-token')).rejects.toMatchObject({
      errorCode: 'access_denied',
    });
  });

  test('lehnt ein abgelaufenes Ticket ab', async () => {
    const provider = makeProvider();
    const { ticket, binding } = await startLogin(provider);

    now += 20 * 60 * 1000; // Ticket gilt 15 Minuten

    await expect(provider.verifyLogin(ticket, binding, 'google-token')).rejects.toThrow(/abgelaufen/);
  });
});

describe('approveLogin und denyLogin', () => {
  test('gibt Code und state an die Rücksprungadresse zurück', async () => {
    const provider = makeProvider();
    const { ticket, binding } = await startLogin(provider, 'mein-state');
    await provider.verifyLogin(ticket, binding, 'google-token');

    const redirect = new URL(await provider.approveLogin(ticket, binding));

    expect(redirect.origin + redirect.pathname).toBe('http://127.0.0.1:9999/cb');
    expect(redirect.searchParams.get('code')).toBeTruthy();
    expect(redirect.searchParams.get('state')).toBe('mein-state');
  });

  test('verlangt eine abgeschlossene Google-Anmeldung', async () => {
    const provider = makeProvider();
    const { ticket, binding } = await startLogin(provider);

    await expect(provider.approveLogin(ticket, binding)).rejects.toThrow(/keine abgeschlossene/);
  });

  test('verbraucht das Ticket', async () => {
    const provider = makeProvider();
    const { ticket, binding } = await startLogin(provider);
    await provider.verifyLogin(ticket, binding, 'google-token');

    await provider.approveLogin(ticket, binding);

    await expect(provider.approveLogin(ticket, binding)).rejects.toThrow(/abgelaufen/);
  });

  test('meldet eine Ablehnung als access_denied an den Client zurück', async () => {
    const provider = makeProvider();
    const { ticket, binding } = await startLogin(provider, 's');
    await provider.verifyLogin(ticket, binding, 'google-token');

    const redirect = new URL(await provider.denyLogin(ticket, binding));

    expect(redirect.searchParams.get('error')).toBe('access_denied');
    expect(redirect.searchParams.get('state')).toBe('s');
    expect(redirect.searchParams.get('code')).toBeNull();
    expect(store.counts().pendingLogins).toBe(0);
  });
});

describe('challengeForAuthorizationCode', () => {
  test('lehnt einen Code eines fremden Clients ab', async () => {
    const provider = makeProvider();
    await store.saveAuthorizationCode({
      codeHash: hashToken('code'),
      clientId: 'jemand-anderes',
      redirectUri: client.redirect_uris[0],
      codeChallenge: 'challenge',
      scopes: [],
      userId: 'u-1',
      username: 'thorsten',
      cookbookToken: 'jwt',
      expiresAt: now + 60_000,
    });

    await expect(provider.challengeForAuthorizationCode(client, 'code')).rejects.toMatchObject({
      errorCode: 'invalid_grant',
    });
  });
});

describe('exchangeAuthorizationCode', () => {
  test('verlangt die Rücksprungadresse der Autorisierung', async () => {
    const provider = makeProvider();
    const { ticket, binding } = await startLogin(provider);
    await provider.verifyLogin(ticket, binding, 'google-token');
    const code = new URL(await provider.approveLogin(ticket, binding)).searchParams.get('code') as string;

    await expect(
      provider.exchangeAuthorizationCode(client, code, undefined, 'https://woanders.example/cb'),
    ).rejects.toMatchObject({ errorCode: 'invalid_grant' });
  });

  test('lehnt einen Tausch ohne Rücksprungadresse ab', async () => {
    const provider = makeProvider();
    const { ticket, binding } = await startLogin(provider);
    await provider.verifyLogin(ticket, binding, 'google-token');
    const code = new URL(await provider.approveLogin(ticket, binding)).searchParams.get('code') as string;

    await expect(provider.exchangeAuthorizationCode(client, code)).rejects.toMatchObject({
      errorCode: 'invalid_grant',
    });
  });

  test('setzt die Gültigkeiten der ausgestellten Token', async () => {
    const provider = makeProvider();

    const tokens = await fullyAuthorize(provider);

    expect(tokens.expires_in).toBe(ACCESS_TOKEN_TTL_MS / 1000);
    const session = store.findSessionByAccessToken(tokens.access_token);
    expect(session?.refreshTokenExpiresAt).toBe(now + REFRESH_TOKEN_TTL_MS);
  });
});

describe('verifyAccessToken', () => {
  test('gibt die Identität und das Kochbuch-Token weiter', async () => {
    const provider = makeProvider();
    const tokens = await fullyAuthorize(provider);

    const info = await provider.verifyAccessToken(tokens.access_token);

    expect(info.clientId).toBe('c-1');
    expect(info.extra).toMatchObject({ userId: 'u-1', username: 'thorsten' });
    expect(typeof info.extra?.cookbookToken).toBe('string');
  });

  test('lehnt ein unbekanntes Token ab', async () => {
    const provider = makeProvider();

    await expect(provider.verifyAccessToken(randomToken())).rejects.toMatchObject({ errorCode: 'invalid_token' });
  });

  test('lehnt ein abgelaufenes Token ab', async () => {
    const provider = makeProvider();
    const tokens = await fullyAuthorize(provider);

    now += ACCESS_TOKEN_TTL_MS + 1;

    await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toMatchObject({
      errorCode: 'invalid_token',
    });
  });
});

describe('exchangeRefreshToken', () => {
  test('lehnt ein Refresh-Token eines fremden Clients ab', async () => {
    const provider = makeProvider();
    const tokens = await fullyAuthorize(provider);

    await expect(
      provider.exchangeRefreshToken({ ...client, client_id: 'anderer' }, tokens.refresh_token as string),
    ).rejects.toMatchObject({ errorCode: 'invalid_grant' });
  });

  test('beendet die Sitzung, wenn das Refresh-Token abgelaufen ist', async () => {
    const provider = makeProvider();
    const tokens = await fullyAuthorize(provider);

    now += REFRESH_TOKEN_TTL_MS + 1;

    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token as string)).rejects.toThrow(
      /abgelaufen/,
    );
    expect(store.counts().sessions).toBe(0);
  });

  test('beendet die Sitzung, wenn das Backend die Erneuerung ablehnt', async () => {
    // Konto gelöscht oder 30-Tage-Kulanz überschritten.
    let allowRefresh = true;
    const provider = makeProvider((call) => {
      if (call.url.pathname === '/api/auth/google') {
        return { body: { token: makeJwt(3600), user: { id: 'u-1', username: 'thorsten', role: 'user' } } };
      }
      if (call.url.pathname === '/api/auth/refresh') {
        return allowRefresh
          ? { body: { token: makeJwt(3600) } }
          : { status: 403, body: { error: 'Token zu lange abgelaufen. Bitte erneut anmelden.' } };
      }
      return { body: {} };
    });
    const tokens = await fullyAuthorize(provider);
    allowRefresh = false;

    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token as string)).rejects.toThrow(
      /neu anmelden/,
    );
    expect(store.counts().sessions).toBe(0);
  });

  test('behält die Sitzung, wenn die API nur vorübergehend nicht erreichbar ist', async () => {
    // Ein Backend-Neustart darf nicht alle Angemeldeten hinauswerfen.
    let erreichbar = true;
    const provider = makeProvider((call) => {
      if (call.url.pathname === '/api/auth/google') {
        return { body: { token: makeJwt(3600), user: { id: 'u-1', username: 'thorsten', role: 'user' } } };
      }
      if (call.url.pathname === '/api/auth/refresh') {
        return erreichbar ? { body: { token: makeJwt(3600) } } : { status: 502, body: { error: 'Bad Gateway' } };
      }
      return { body: {} };
    });
    const tokens = await fullyAuthorize(provider);
    erreichbar = false;

    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token as string)).rejects.toMatchObject({
      errorCode: 'server_error',
    });
    expect(store.counts().sessions).toBe(1);

    // Sobald die API wieder da ist, funktioniert dasselbe Refresh-Token.
    erreichbar = true;
    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token as string)).resolves.toMatchObject({
      token_type: 'Bearer',
    });
  });

  test('tauscht beide Token aus und macht die alten ungültig', async () => {
    const provider = makeProvider();
    const tokens = await fullyAuthorize(provider);

    const renewed = await provider.exchangeRefreshToken(client, tokens.refresh_token as string);

    expect(renewed.access_token).not.toBe(tokens.access_token);
    expect(renewed.refresh_token).not.toBe(tokens.refresh_token);
    expect(store.findSessionByAccessToken(tokens.access_token)).toBeUndefined();
    expect(store.findSessionByRefreshToken(tokens.refresh_token as string)).toBeUndefined();
    expect(store.counts().sessions).toBe(1);
  });
});

describe('revokeToken', () => {
  test('bleibt bei einem unbekannten Token wirkungslos, ohne zu scheitern', async () => {
    const provider = makeProvider();

    await expect(provider.revokeToken(client, { token: 'gibtsnicht' })).resolves.toBeUndefined();
  });

  test('widerruft nur Token des eigenen Clients', async () => {
    // RFC 7009: Ein fremder Client darf keine Sitzung beenden.
    const provider = makeProvider();
    const tokens = await fullyAuthorize(provider);

    await provider.revokeToken({ ...client, client_id: 'anderer' }, { token: tokens.access_token });

    expect(store.counts().sessions).toBe(1);
  });

  test('widerruft die eigene Sitzung', async () => {
    const provider = makeProvider();
    const tokens = await fullyAuthorize(provider);

    await provider.revokeToken(client, { token: tokens.access_token });

    expect(store.counts().sessions).toBe(0);
  });
});
