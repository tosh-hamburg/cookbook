import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sessionClientResolver, staticClientResolver } from './client-resolver.js';
import { CookbookApiClient } from './api/client.js';
import { hashToken, OAuthStore } from './oauth/store.js';
import { createFetchStub, makeApiOptions, makeJwt, makeRecipe } from './test-utils.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

let dir: string;
let store: OAuthStore;

function authInfo(extra: Record<string, unknown>): AuthInfo {
  return { token: 'access', clientId: 'c-1', scopes: [], extra };
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'cookbook-resolver-'));
  store = new OAuthStore(dir);
  await store.load();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('staticClientResolver', () => {
  test('liefert immer denselben Client', () => {
    const client = new CookbookApiClient(makeApiOptions());
    const resolve = staticClientResolver(client);

    expect(resolve({})).toBe(client);
    expect(resolve({ authInfo: authInfo({}) })).toBe(client);
  });
});

describe('sessionClientResolver', () => {
  const endpoint = { apiUrl: 'https://api.example.test', timeoutMs: 5_000 };

  test('spricht die API mit dem Token der angemeldeten Person', async () => {
    const { fetch, calls } = createFetchStub(() => ({ body: makeRecipe() }));
    const resolve = sessionClientResolver({ endpoint, store, fetchImpl: fetch });

    await resolve({ authInfo: authInfo({ sessionId: 's-1', cookbookToken: 'jwt-der-person' }) }).getRecipe('r-1');

    expect(calls[0].headers.authorization).toBe('Bearer jwt-der-person');
  });

  test('schreibt ein erneuertes Token in die Sitzung zurück', async () => {
    // Sonst müsste sich die Person nach sieben Tagen neu anmelden, obwohl das
    // OAuth-Refresh-Token noch 30 Tage gilt.
    const abgelaufen = makeJwt(-10);
    await store.saveSession({
      id: 's-1',
      clientId: 'c-1',
      scopes: [],
      userId: 'u-1',
      username: 'thorsten',
      cookbookToken: abgelaufen,
      accessTokenHash: hashToken('access'),
      accessTokenExpiresAt: Date.now() + 60_000,
      refreshTokenHash: hashToken('refresh'),
      refreshTokenExpiresAt: Date.now() + 60_000,
    });

    const frisch = makeJwt(3600);
    const { fetch, calls } = createFetchStub((call) =>
      call.url.pathname === '/api/auth/refresh' ? { body: { token: frisch } } : { body: makeRecipe() },
    );
    const resolve = sessionClientResolver({ endpoint, store, fetchImpl: fetch });

    await resolve({ authInfo: authInfo({ sessionId: 's-1', cookbookToken: abgelaufen }) }).getRecipe('r-1');

    expect(calls[0].url.pathname).toBe('/api/auth/refresh');
    expect(store.findSessionByAccessToken('access')?.cookbookToken).toBe(frisch);
  });

  test('scheitert deutlich, wenn keine Identität mitkommt', () => {
    const resolve = sessionClientResolver({ endpoint, store });

    expect(() => resolve({})).toThrow(/Kein angemeldetes Kochbuch-Konto/);
  });

  test('scheitert, wenn die Sitzungskennung fehlt', () => {
    const resolve = sessionClientResolver({ endpoint, store });

    expect(() => resolve({ authInfo: authInfo({ cookbookToken: 'jwt' }) })).toThrow(/Kein angemeldetes/);
  });
});
