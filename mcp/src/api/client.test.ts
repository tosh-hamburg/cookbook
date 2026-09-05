import { describe, expect, test } from 'vitest';
import { CookbookApiClient, readTokenExpiry } from './client.js';
import { ApiConnectionError, ApiError, TwoFactorRequiredError } from '../errors.js';
import { createFetchStub, makeApiOptions, makeJwt, makeRecipe } from '../test-utils.js';
import type { Fetch } from './client.js';

const passwordConfig = makeApiOptions({
  credentials: { kind: 'password', username: 'thorsten', password: 'geheim' },
});

describe('CookbookApiClient — Authentifizierung', () => {
  test('sendet ein statisches Token als Bearer-Header', async () => {
    const { fetch, calls } = createFetchStub(() => ({ body: makeRecipe() }));
    const client = new CookbookApiClient(makeApiOptions(), fetch);

    await client.getRecipe('r-1');

    expect(calls[0].headers.authorization).toBe('Bearer test-token');
  });

  test('meldet sich mit Benutzername und Passwort an und nutzt das erhaltene Token', async () => {
    const { fetch, calls } = createFetchStub((call) =>
      call.url.pathname === '/api/auth/login' ? { body: { token: 'frisches-token' } } : { body: makeRecipe() },
    );
    const client = new CookbookApiClient(passwordConfig, fetch);

    await client.getRecipe('r-1');

    expect(calls[0].url.pathname).toBe('/api/auth/login');
    expect(calls[0].body).toEqual({ username: 'thorsten', password: 'geheim' });
    expect(calls[1].headers.authorization).toBe('Bearer frisches-token');
  });

  test('meldet sich für weitere Aufrufe nicht erneut an', async () => {
    const { fetch, calls } = createFetchStub((call) =>
      call.url.pathname === '/api/auth/login' ? { body: { token: makeJwt(3600) } } : { body: makeRecipe() },
    );
    const client = new CookbookApiClient(passwordConfig, fetch);

    await client.getRecipe('r-1');
    await client.getRecipe('r-2');

    expect(calls.filter((c) => c.url.pathname === '/api/auth/login')).toHaveLength(1);
  });

  test('bündelt gleichzeitige Aufrufe zu einem einzigen Login', async () => {
    // Das Login-Rate-Limit erlaubt nur 5 Versuche pro 15 Minuten.
    const { fetch, calls } = createFetchStub((call) =>
      call.url.pathname === '/api/auth/login' ? { body: { token: makeJwt(3600) } } : { body: makeRecipe() },
    );
    const client = new CookbookApiClient(passwordConfig, fetch);

    await Promise.all([client.getRecipe('r-1'), client.getRecipe('r-2'), client.getRecipe('r-3')]);

    expect(calls.filter((c) => c.url.pathname === '/api/auth/login')).toHaveLength(1);
  });

  test('erneuert ein kurz vor Ablauf stehendes Token', async () => {
    const { fetch, calls } = createFetchStub((call) =>
      call.url.pathname === '/api/auth/login' ? { body: { token: makeJwt(30) } } : { body: makeRecipe() },
    );
    const client = new CookbookApiClient(passwordConfig, fetch);

    await client.getRecipe('r-1');
    await client.getRecipe('r-2');

    // Ablauf in 30 s liegt innerhalb der 60-Sekunden-Sicherheitsmarge.
    expect(calls.filter((c) => c.url.pathname === '/api/auth/login')).toHaveLength(2);
  });

  test('meldet aktivierte Zwei-Faktor-Authentifizierung verständlich', async () => {
    const { fetch } = createFetchStub((call) =>
      call.url.pathname === '/api/auth/login' ? { body: { requires2FA: true } } : undefined,
    );
    const client = new CookbookApiClient(passwordConfig, fetch);

    await expect(client.getRecipe('r-1')).rejects.toBeInstanceOf(TwoFactorRequiredError);
  });

  test('meldet einen Login ohne Token als Fehler', async () => {
    const { fetch } = createFetchStub((call) =>
      call.url.pathname === '/api/auth/login' ? { body: { user: { id: 'u-1' } } } : undefined,
    );
    const client = new CookbookApiClient(passwordConfig, fetch);

    await expect(client.getRecipe('r-1')).rejects.toThrow(/kein Token/);
  });

  test('reicht falsche Zugangsdaten als ApiError durch', async () => {
    const { fetch } = createFetchStub((call) =>
      call.url.pathname === '/api/auth/login' ? { status: 401, body: { error: 'Ungültige Anmeldedaten' } } : undefined,
    );
    const client = new CookbookApiClient(passwordConfig, fetch);

    await expect(client.getRecipe('r-1')).rejects.toThrow(/Ungültige Anmeldedaten/);
  });
});

describe('CookbookApiClient — abgelaufene Sitzung', () => {
  test('meldet sich nach einem 401 einmal neu an und wiederholt den Aufruf', async () => {
    let recipeCalls = 0;
    const { fetch, calls } = createFetchStub((call) => {
      if (call.url.pathname === '/api/auth/login') return { body: { token: makeJwt(3600) } };
      recipeCalls += 1;
      return recipeCalls === 1 ? { status: 401, body: { error: 'Ungültiger Token' } } : { body: makeRecipe() };
    });
    const client = new CookbookApiClient(passwordConfig, fetch);

    const recipe = await client.getRecipe('r-1');

    expect(recipe.title).toBe('Linsensuppe');
    expect(calls.filter((c) => c.url.pathname === '/api/auth/login')).toHaveLength(2);
  });

  test('wiederholt höchstens einmal', async () => {
    const { fetch, calls } = createFetchStub((call) =>
      call.url.pathname === '/api/auth/login'
        ? { body: { token: makeJwt(3600) } }
        : { status: 401, body: { error: 'Ungültiger Token' } },
    );
    const client = new CookbookApiClient(passwordConfig, fetch);

    await expect(client.getRecipe('r-1')).rejects.toBeInstanceOf(ApiError);
    expect(calls.filter((c) => c.url.pathname.startsWith('/api/recipes'))).toHaveLength(2);
  });

  test('wiederholt nicht, wenn nur ein statisches Token vorliegt', async () => {
    const { fetch, calls } = createFetchStub(() => ({ status: 403, body: { error: 'Ungültiger Token' } }));
    const client = new CookbookApiClient(makeApiOptions(), fetch);

    await expect(client.getRecipe('r-1')).rejects.toMatchObject({ name: 'ApiError', status: 403 });
    expect(calls).toHaveLength(1);
  });
});

describe('CookbookApiClient — Anfragen', () => {
  test('baut Filter- und Seitenparameter, überspringt leere Werte', async () => {
    const { fetch, calls } = createFetchStub(() => ({ body: { items: [], total: 0, hasMore: false } }));
    const client = new CookbookApiClient(makeApiOptions(), fetch);

    await client.listRecipes({ search: 'Suppe', category: undefined, collections: '', limit: 5, offset: 10 });

    expect(calls[0].url.searchParams.get('search')).toBe('Suppe');
    expect(calls[0].url.searchParams.has('category')).toBe(false);
    expect(calls[0].url.searchParams.has('collections')).toBe(false);
    expect(calls[0].url.searchParams.get('limit')).toBe('5');
    expect(calls[0].url.searchParams.get('offset')).toBe('10');
  });

  test('verzichtet beim Auflisten auf die Thumbnail-Erzeugung', async () => {
    const { fetch, calls } = createFetchStub(() => ({ body: { items: [], total: 0, hasMore: false } }));
    const client = new CookbookApiClient(makeApiOptions(), fetch);

    await client.listRecipes({});

    expect(calls[0].url.searchParams.get('thumbnails')).toBe('false');
  });

  test('kodiert IDs im Pfad', async () => {
    const { fetch, calls } = createFetchStub(() => ({ body: makeRecipe() }));
    const client = new CookbookApiClient(makeApiOptions(), fetch);

    await client.getRecipe('a b/c');

    expect(calls[0].url.pathname).toBe('/api/recipes/a%20b%2Fc');
  });

  test('sendet den Rezept-Rumpf als JSON', async () => {
    const { fetch, calls } = createFetchStub(() => ({ status: 201, body: makeRecipe() }));
    const client = new CookbookApiClient(makeApiOptions(), fetch);
    const payload = { ...makeRecipe(), id: undefined } as never;

    await client.createRecipe(payload);

    expect(calls[0].method).toBe('POST');
    expect(calls[0].headers['content-type']).toBe('application/json');
  });

  test('übersetzt Fehlerantworten in ApiError mit der Meldung der API', async () => {
    const { fetch } = createFetchStub(() => ({ status: 404, body: { error: 'Rezept nicht gefunden' } }));
    const client = new CookbookApiClient(makeApiOptions(), fetch);

    await expect(client.getRecipe('fehlt')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Rezept nicht gefunden',
    });
  });

  test('verkraftet Fehlerantworten, die kein JSON sind', async () => {
    const { fetch } = createFetchStub(() => ({ status: 502, text: '<html>Bad Gateway</html>' }));
    const client = new CookbookApiClient(makeApiOptions(), fetch);

    await expect(client.getRecipe('r-1')).rejects.toThrow(/Bad Gateway/);
  });

  test('meldet ungültiges JSON in einer Erfolgsantwort', async () => {
    const { fetch } = createFetchStub(() => ({ status: 200, text: 'kein json' }));
    const client = new CookbookApiClient(makeApiOptions(), fetch);

    await expect(client.getRecipe('r-1')).rejects.toThrow(/kein gültiges JSON/);
  });

  test('meldet Netzwerkfehler als ApiConnectionError', async () => {
    const failing = (() => Promise.reject(new Error('ECONNREFUSED'))) as Fetch;
    const client = new CookbookApiClient(makeApiOptions(), failing);

    await expect(client.getRecipe('r-1')).rejects.toBeInstanceOf(ApiConnectionError);
  });

  test('bildet Sammlungs-Endpunkte korrekt ab', async () => {
    const { fetch, calls } = createFetchStub(() => ({ body: {} }));
    const client = new CookbookApiClient(makeApiOptions(), fetch);

    await client.addRecipeToCollection('c-1', 'r-1');
    await client.removeRecipeFromCollection('c-1', 'r-1');

    expect(calls[0]).toMatchObject({ method: 'POST' });
    expect(calls[0].url.pathname).toBe('/api/collections/c-1/recipes/r-1');
    expect(calls[1].method).toBe('DELETE');
  });

  test('ruft den Import-Endpunkt mit der URL auf', async () => {
    const { fetch, calls } = createFetchStub(() => ({ body: { title: 'X' } }));
    const client = new CookbookApiClient(makeApiOptions(), fetch);

    await client.importFromUrl('https://example.test/rezept');

    expect(calls[0].url.pathname).toBe('/api/import');
    expect(calls[0].body).toEqual({ url: 'https://example.test/rezept' });
  });
});

describe('readTokenExpiry', () => {
  test('liest exp aus einem JWT', () => {
    const token = makeJwt(60);

    expect(readTokenExpiry(token)).toBeGreaterThan(Date.now());
  });

  test('liefert null für Zeichenketten, die kein JWT sind', () => {
    expect(readTokenExpiry('nur-ein-string')).toBeNull();
  });

  test('liefert null, wenn die Nutzlast kein exp enthält', () => {
    const payload = Buffer.from(JSON.stringify({ sub: 'u-1' })).toString('base64url');

    expect(readTokenExpiry(`a.${payload}.c`)).toBeNull();
  });

  test('liefert null bei kaputter Nutzlast', () => {
    expect(readTokenExpiry('a.!!!.c')).toBeNull();
  });
});
