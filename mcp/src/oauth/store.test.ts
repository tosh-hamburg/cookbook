import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { hashToken, OAuthStore, randomToken, type Session } from './store.js';

/** Bewusst eigenwillige Werte: Sie dürfen im JSON nirgends auftauchen. */
const ACCESS = 'zugriffsgeheimnis';
const REFRESH = 'erneuerungsgeheimnis';

let dir: string;
let store: OAuthStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'cookbook-store-'));
  store = new OAuthStore(dir);
  await store.load();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function makeSession(overrides: Partial<Session> = {}): Session {
  const future = Date.now() + 60_000;
  return {
    id: 's-1',
    clientId: 'c-1',
    scopes: [],
    userId: 'u-1',
    username: 'thorsten',
    cookbookToken: 'jwt',
    accessTokenHash: hashToken(ACCESS),
    accessTokenExpiresAt: future,
    refreshTokenHash: hashToken(REFRESH),
    refreshTokenExpiresAt: future,
    ...overrides,
  };
}

describe('randomToken und hashToken', () => {
  test('erzeugt URL-sichere Token', () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test('erzeugt keine zwei gleichen Token', () => {
    expect(randomToken()).not.toBe(randomToken());
  });

  test('hasht stabil', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});

describe('Beständigkeit', () => {
  test('startet leer, wenn noch keine Datei existiert', () => {
    expect(store.counts()).toEqual({ clients: 0, pendingLogins: 0, authorizationCodes: 0, sessions: 0 });
  });

  test('übersteht einen Neustart', async () => {
    await store.saveClient({ client_id: 'c-1', redirect_uris: ['http://localhost/cb'] });
    await store.saveSession(makeSession());

    const wiederGeladen = new OAuthStore(dir);
    await wiederGeladen.load();

    expect(wiederGeladen.getClient('c-1')?.redirect_uris).toEqual(['http://localhost/cb']);
    expect(wiederGeladen.findSessionByAccessToken(ACCESS)?.username).toBe('thorsten');
  });

  test('legt die Datei nur für den Eigentümer lesbar an', async () => {
    await store.saveClient({ client_id: 'c-1', redirect_uris: [] });

    const info = await stat(path.join(dir, 'oauth.json'));

    // Unter Windows kennt der Modus keine Gruppen-/Andere-Bits; dort prüfen wir
    // nur, dass die Datei überhaupt entstanden ist.
    if (process.platform !== 'win32') {
      expect(info.mode & 0o077).toBe(0);
    }
    expect(info.isFile()).toBe(true);
  });

  test('speichert Token niemals im Klartext', async () => {
    await store.saveSession(makeSession());

    const raw = await readFile(path.join(dir, 'oauth.json'), 'utf8');

    expect(raw).not.toContain(ACCESS);
    expect(raw).not.toContain(REFRESH);
    expect(raw).toContain(hashToken(ACCESS));
  });

  test('meldet eine unlesbare Datei, statt still leer zu starten', async () => {
    await store.saveClient({ client_id: 'c-1', redirect_uris: [] });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path.join(dir, 'oauth.json'), '{kein json');

    const kaputt = new OAuthStore(dir);

    await expect(kaputt.load()).rejects.toThrow(/nicht lesbar/);
  });
});

describe('Laufende Anmeldungen', () => {
  const pending = {
    ticket: 't-1',
    browserBindingHash: hashToken('bindung'),
    clientId: 'c-1',
    redirectUri: 'http://localhost/cb',
    codeChallenge: 'challenge',
    scopes: [],
    expiresAt: Date.now() + 60_000,
  };

  test('lässt sich lesen, ohne verbraucht zu werden', async () => {
    await store.savePendingLogin(pending);

    expect(store.peekPendingLogin('t-1')?.clientId).toBe('c-1');
    expect(store.peekPendingLogin('t-1')).toBeDefined();
  });

  test('gilt nur ein einziges Mal', async () => {
    await store.savePendingLogin(pending);

    expect(await store.takePendingLogin('t-1')).toBeDefined();
    expect(await store.takePendingLogin('t-1')).toBeUndefined();
  });

  test('verfällt nach Ablauf', async () => {
    await store.savePendingLogin({ ...pending, expiresAt: Date.now() - 1 });

    expect(store.peekPendingLogin('t-1')).toBeUndefined();
    expect(await store.takePendingLogin('t-1')).toBeUndefined();
  });
});

describe('Autorisierungscodes', () => {
  const code = 'geheimer-code';
  const entry = {
    codeHash: hashToken(code),
    clientId: 'c-1',
    redirectUri: 'http://localhost/cb',
    codeChallenge: 'challenge',
    scopes: [],
    userId: 'u-1',
    username: 'thorsten',
    cookbookToken: 'jwt',
    expiresAt: Date.now() + 60_000,
  };

  test('findet einen Code über seinen Hash', async () => {
    await store.saveAuthorizationCode(entry);

    expect(store.peekAuthorizationCode(code)?.userId).toBe('u-1');
  });

  test('lässt sich nur einmal einlösen', async () => {
    await store.saveAuthorizationCode(entry);

    expect(await store.takeAuthorizationCode(code)).toBeDefined();
    expect(await store.takeAuthorizationCode(code)).toBeUndefined();
  });

  test('verfällt nach Ablauf', async () => {
    await store.saveAuthorizationCode({ ...entry, expiresAt: Date.now() - 1 });

    expect(store.peekAuthorizationCode(code)).toBeUndefined();
  });
});

describe('Sitzungen', () => {
  test('findet eine Sitzung über Access- und Refresh-Token', async () => {
    await store.saveSession(makeSession());

    expect(store.findSessionByAccessToken(ACCESS)?.id).toBe('s-1');
    expect(store.findSessionByRefreshToken(REFRESH)?.id).toBe('s-1');
    expect(store.findSessionByAccessToken(REFRESH)).toBeUndefined();
  });

  test('aktualisiert das Kochbuch-Token', async () => {
    await store.saveSession(makeSession());

    await store.updateCookbookToken('s-1', 'neues-jwt');

    expect(store.findSessionByAccessToken(ACCESS)?.cookbookToken).toBe('neues-jwt');
  });

  test('ignoriert die Aktualisierung einer unbekannten Sitzung', async () => {
    await expect(store.updateCookbookToken('gibtsnicht', 'x')).resolves.toBeUndefined();
  });

  test('entfernt eine Sitzung über eines ihrer Token', async () => {
    await store.saveSession(makeSession());

    expect(await store.deleteSessionByToken(REFRESH)).toBe(true);
    expect(store.counts().sessions).toBe(0);
  });

  test('meldet einen Widerruf für ein unbekanntes Token als wirkungslos', async () => {
    expect(await store.deleteSessionByToken('gibtsnicht')).toBe(false);
  });
});

describe('purgeExpired', () => {
  test('räumt abgelaufene Anmeldungen, Codes und Sitzungen weg', async () => {
    const past = Date.now() - 1;
    await store.savePendingLogin({
      ticket: 't-alt',
      browserBindingHash: hashToken('bindung'),
      clientId: 'c-1',
      redirectUri: 'http://localhost/cb',
      codeChallenge: 'x',
      scopes: [],
      expiresAt: past,
    });
    await store.saveAuthorizationCode({
      codeHash: hashToken('alt'),
      clientId: 'c-1',
      redirectUri: 'http://localhost/cb',
      codeChallenge: 'x',
      scopes: [],
      userId: 'u-1',
      username: 'thorsten',
      cookbookToken: 'jwt',
      expiresAt: past,
    });
    await store.saveSession(makeSession({ id: 's-alt', refreshTokenExpiresAt: past }));

    expect(await store.purgeExpired()).toBe(3);
    expect(store.counts()).toMatchObject({ pendingLogins: 0, authorizationCodes: 0, sessions: 0 });
  });

  test('behält eine Sitzung, deren Access-Token abgelaufen ist, aber das Refresh-Token nicht', async () => {
    await store.saveSession(makeSession({ accessTokenExpiresAt: Date.now() - 1 }));

    expect(await store.purgeExpired()).toBe(0);
    expect(store.counts().sessions).toBe(1);
  });

  test('lässt Clients unangetastet', async () => {
    await store.saveClient({ client_id: 'c-1', redirect_uris: [] });

    await store.purgeExpired();

    expect(store.getClient('c-1')).toBeDefined();
  });
});
