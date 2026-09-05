import type { Config, HttpConfig } from './config.js';
import type { ApiRecipe } from './api/types.js';
import type { ApiClientOptions, Fetch } from './api/client.js';

/** Aufgezeichneter Aufruf des fetch-Doubles. */
export interface RecordedCall {
  url: URL;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

export interface StubResponse {
  status?: number;
  body?: unknown;
  /** Roher Text statt JSON — für Tests mit ungültigem JSON. */
  text?: string;
}

export type StubHandler = (call: RecordedCall) => StubResponse | undefined;

/**
 * Erzeugt ein fetch-Double, das Aufrufe aufzeichnet und die Antwort aus dem
 * übergebenen Handler bildet. Ein nicht behandelter Pfad ergibt 404.
 */
export function createFetchStub(handler: StubHandler): { fetch: Fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
    const call: RecordedCall = {
      url,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      headers: normalizeHeaders(init?.headers),
    };
    calls.push(call);

    const result = handler(call) ?? { status: 404, body: { error: 'Nicht gefunden' } };
    const status = result.status ?? 200;
    const payload = result.text ?? JSON.stringify(result.body ?? {});
    return new Response(payload, { status, headers: { 'Content-Type': 'application/json' } });
  }) as Fetch;

  return { fetch: fetchImpl, calls };
}

function normalizeHeaders(headers: RequestInit['headers']): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;
  for (const [key, value] of Object.entries(headers as Record<string, string>)) {
    result[key.toLowerCase()] = value;
  }
  return result;
}

/** Verbindungsdaten für den API-Client. */
export function makeApiOptions(overrides: Partial<ApiClientOptions> = {}): ApiClientOptions {
  return {
    apiUrl: 'https://api.example.test',
    timeoutMs: 5_000,
    credentials: { kind: 'token', token: 'test-token' },
    ...overrides,
  };
}

export function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    apiUrl: 'https://api.example.test',
    timeoutMs: 5_000,
    transport: 'stdio',
    credentials: { kind: 'token', token: 'test-token' },
    http: null,
    ...overrides,
  };
}

export function makeHttpConfig(overrides: Partial<HttpConfig> = {}): HttpConfig {
  return {
    host: '127.0.0.1',
    port: 0,
    publicUrl: 'https://kochbuch.example.test',
    googleClientId: '1234567890-test.apps.googleusercontent.com',
    dataDir: './.data-test',
    allowedRedirectOrigins: ['https://claude.ai'],
    ...overrides,
  };
}

export function makeRecipe(overrides: Partial<ApiRecipe> = {}): ApiRecipe {
  return {
    id: 'r-1',
    title: 'Linsensuppe',
    images: [],
    ingredients: [
      { name: 'Linsen', amount: '250 g' },
      { name: 'Karotten', amount: '2 Stück' },
    ],
    instructions: 'Alles kochen.',
    prepTime: 15,
    restTime: 0,
    cookTime: 45,
    totalTime: 60,
    servings: 4,
    caloriesPerUnit: 320,
    weightUnit: 'Portion',
    sourceUrl: null,
    notes: null,
    categories: ['Hauptgericht'],
    collections: [],
    userId: 'u-1',
    createdAt: '2026-01-01T10:00:00.000Z',
    ...overrides,
  };
}

/** Baut ein JWT-ähnliches Token mit gesetztem exp (Signatur ist irrelevant). */
export function makeJwt(expSecondsFromNow: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })).toString(
    'base64url',
  );
  return `header.${payload}.signature`;
}
