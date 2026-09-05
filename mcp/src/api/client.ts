import { ApiConnectionError, ApiError, TwoFactorRequiredError } from '../errors.js';
import type { Credentials } from '../config.js';
import type {
  ApiCategory,
  ApiCollection,
  ApiRecipe,
  ApiRecipeListResponse,
  ApiScrapedRecipe,
  ApiUser,
  RecipeWritePayload,
} from './types.js';

export interface ApiClientOptions {
  apiUrl: string;
  timeoutMs: number;
  credentials: Credentials;
}

/** Verbindungsdaten ohne Konto — für Anmeldung und Token-Erneuerung. */
export interface ApiEndpoint {
  apiUrl: string;
  timeoutMs: number;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Interner Wiederholungsschutz: verhindert Login-Schleifen bei 401. */
  isRetry?: boolean;
}

interface AuthResponse {
  token?: string;
  requires2FA?: boolean;
  user?: ApiUser;
}

/** Sicherheitsabstand, mit dem ein Token vor Ablauf erneuert wird. */
const TOKEN_REFRESH_MARGIN_MS = 60_000;

export type Fetch = typeof globalThis.fetch;

/**
 * Schmaler Client für die Kochbuch-REST-API.
 *
 * Kümmert sich um Authentifizierung (festes JWT, Login mit Benutzername und
 * Passwort oder das Token einer angemeldeten Person), Timeouts und die
 * Übersetzung von Fehlerantworten in {@link ApiError}.
 */
export class CookbookApiClient {
  private readonly options: ApiClientOptions;
  private readonly fetchImpl: Fetch;
  private token: string | null = null;
  private tokenExpiresAt: number | null = null;
  private pendingRenewal: Promise<string> | null = null;

  constructor(options: ApiClientOptions, fetchImpl: Fetch = globalThis.fetch) {
    this.options = options;
    this.fetchImpl = fetchImpl;
    const { credentials } = options;
    if (credentials.kind === 'token' || credentials.kind === 'session') {
      this.token = credentials.token;
      this.tokenExpiresAt = readTokenExpiry(credentials.token);
    }
  }

  // ---------------------------------------------------------------- Rezepte

  async listRecipes(params: {
    search?: string;
    category?: string;
    collections?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiRecipeListResponse> {
    // thumbnails=false spart dem Backend eine Sharp-Konvertierung je Treffer —
    // die Bilddaten würden hier ohnehin verworfen. Ältere Backend-Stände
    // ignorieren den Parameter und liefern weiterhin Thumbnails.
    return this.request<ApiRecipeListResponse>('/api/recipes', {
      query: { ...params, thumbnails: 'false' },
    });
  }

  async getRecipe(id: string): Promise<ApiRecipe> {
    return this.request<ApiRecipe>(`/api/recipes/${encodeURIComponent(id)}`);
  }

  async createRecipe(payload: RecipeWritePayload): Promise<ApiRecipe> {
    return this.request<ApiRecipe>('/api/recipes', { method: 'POST', body: payload });
  }

  /**
   * Ersetzt ein Rezept vollständig.
   *
   * Wichtig: Das Backend löscht bei jedem PUT zuerst alle Zutaten und
   * Kategorien und legt nur die im Body übergebenen neu an. Teilaktualisierungen
   * sind daher NICHT möglich — Aufrufer müssen immer den kompletten Datensatz
   * senden (siehe `mergeRecipe`).
   */
  async replaceRecipe(id: string, payload: RecipeWritePayload): Promise<ApiRecipe> {
    return this.request<ApiRecipe>(`/api/recipes/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
  }

  async deleteRecipe(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/recipes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  // ------------------------------------------------- Kategorien/Sammlungen

  async listCategories(): Promise<ApiCategory[]> {
    return this.request<ApiCategory[]>('/api/categories');
  }

  async listCollections(): Promise<ApiCollection[]> {
    return this.request<ApiCollection[]>('/api/collections');
  }

  async addRecipeToCollection(collectionId: string, recipeId: string): Promise<unknown> {
    return this.request(
      `/api/collections/${encodeURIComponent(collectionId)}/recipes/${encodeURIComponent(recipeId)}`,
      { method: 'POST' },
    );
  }

  async removeRecipeFromCollection(collectionId: string, recipeId: string): Promise<unknown> {
    return this.request(
      `/api/collections/${encodeURIComponent(collectionId)}/recipes/${encodeURIComponent(recipeId)}`,
      { method: 'DELETE' },
    );
  }

  // ------------------------------------------------------------------ Import

  /** Liest ein Rezept von einer Webseite aus, speichert es aber noch nicht. */
  async importFromUrl(url: string): Promise<ApiScrapedRecipe> {
    return this.request<ApiScrapedRecipe>('/api/import', { method: 'POST', body: { url } });
  }

  // ------------------------------------------------------------------ intern

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, query, isRetry = false } = options;
    const url = buildUrl(this.options.apiUrl, path, query);
    const token = await this.ensureToken();

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      throw new ApiConnectionError(url, error);
    }

    // Abgelaufenes Token: einmalig erneuern und den Aufruf wiederholen.
    if ((response.status === 401 || response.status === 403) && !isRetry && this.canRenewToken()) {
      this.token = null;
      this.tokenExpiresAt = null;
      return this.request<T>(path, { ...options, isRetry: true });
    }

    if (!response.ok) {
      throw new ApiError(response.status, path, await readErrorMessage(response));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new ApiError(response.status, path, `Antwort war kein gültiges JSON: ${String(error)}`);
    }
  }

  private canRenewToken(): boolean {
    return this.options.credentials.kind !== 'token';
  }

  private async ensureToken(): Promise<string> {
    if (this.token && !this.isTokenExpired()) {
      return this.token;
    }
    if (this.options.credentials.kind === 'token') {
      // Festes Token: nicht erneuerbar, also unverändert nutzen und die API
      // über den Ablauf entscheiden lassen.
      return this.options.credentials.token;
    }
    // Parallele Aufrufe teilen sich eine Erneuerung — das Login-Rate-Limit
    // erlaubt nur 5 Versuche pro 15 Minuten.
    this.pendingRenewal ??= this.renewToken().finally(() => {
      this.pendingRenewal = null;
    });
    return this.pendingRenewal;
  }

  private isTokenExpired(): boolean {
    if (this.tokenExpiresAt === null) return false;
    return Date.now() >= this.tokenExpiresAt - TOKEN_REFRESH_MARGIN_MS;
  }

  private async renewToken(): Promise<string> {
    const credentials = this.options.credentials;
    const renewed =
      credentials.kind === 'password'
        ? await login(this.options, credentials.username, credentials.password, this.fetchImpl)
        : await renewSession(credentials as Extract<Credentials, { kind: 'session' }>, this.options, this.fetchImpl);

    this.token = renewed;
    this.tokenExpiresAt = readTokenExpiry(renewed);
    return renewed;
  }
}

/** Meldet sich mit Benutzername und Passwort an und liefert das Kochbuch-JWT. */
async function login(endpoint: ApiEndpoint, username: string, password: string, fetchImpl: Fetch): Promise<string> {
  const data = await postAuth(endpoint, '/api/auth/login', { username, password }, undefined, fetchImpl);
  if (data.requires2FA) {
    throw new TwoFactorRequiredError();
  }
  if (!data.token) {
    throw new ApiError(200, '/api/auth/login', 'Antwort enthielt kein Token');
  }
  return data.token;
}

/**
 * Erneuert das Token einer angemeldeten Person.
 *
 * `POST /api/auth/refresh` akzeptiert auch bereits abgelaufene Token, solange
 * sie höchstens 30 Tage über der Gültigkeit liegen. Damit übersteht eine
 * Sitzung eine längere Pause, ohne dass sich jemand neu anmelden muss.
 */
async function renewSession(
  credentials: Extract<Credentials, { kind: 'session' }>,
  endpoint: ApiEndpoint,
  fetchImpl: Fetch,
): Promise<string> {
  const token = await refreshCookbookToken(endpoint, credentials.token, fetchImpl);
  credentials.token = token;
  await credentials.onTokenRefreshed?.(token);
  return token;
}

/** Tauscht ein abgelaufenes oder bald ablaufendes Kochbuch-JWT gegen ein frisches. */
export async function refreshCookbookToken(
  endpoint: ApiEndpoint,
  token: string,
  fetchImpl: Fetch = globalThis.fetch,
): Promise<string> {
  const data = await postAuth(endpoint, '/api/auth/refresh', {}, token, fetchImpl);
  if (!data.token) {
    throw new ApiError(200, '/api/auth/refresh', 'Antwort enthielt kein Token');
  }
  return data.token;
}

/**
 * Tauscht ein Google-ID-Token gegen ein Kochbuch-JWT — derselbe Endpunkt, den
 * auch die Website beim "Mit Google anmelden" verwendet.
 */
export async function exchangeGoogleCredential(
  endpoint: ApiEndpoint,
  credential: string,
  fetchImpl: Fetch = globalThis.fetch,
): Promise<{ token: string; user: ApiUser }> {
  const data = await postAuth(endpoint, '/api/auth/google', { credential }, undefined, fetchImpl);
  if (!data.token || !data.user) {
    throw new ApiError(200, '/api/auth/google', 'Antwort enthielt kein Token');
  }
  return { token: data.token, user: data.user };
}

async function postAuth(
  endpoint: ApiEndpoint,
  path: string,
  body: unknown,
  bearer: string | undefined,
  fetchImpl: Fetch,
): Promise<AuthResponse> {
  const url = buildUrl(endpoint.apiUrl, path);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(endpoint.timeoutMs),
    });
  } catch (error) {
    throw new ApiConnectionError(url, error);
  }

  if (!response.ok) {
    throw new ApiError(response.status, path, await readErrorMessage(response));
  }

  try {
    return (await response.json()) as AuthResponse;
  } catch (error) {
    throw new ApiError(response.status, path, `Antwort war kein gültiges JSON: ${String(error)}`);
  }
}

function buildUrl(apiUrl: string, path: string, query?: Record<string, string | number | undefined>): string {
  const url = new URL(apiUrl + path);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** Liest `exp` aus einem JWT, ohne die Signatur zu prüfen (nur für Refresh-Timing). */
export function readTokenExpiry(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return response.statusText || 'Unbekannter Fehler';
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      return parsed.error ?? parsed.message ?? text.slice(0, 500);
    } catch {
      return text.slice(0, 500);
    }
  } catch {
    return response.statusText || 'Unbekannter Fehler';
  }
}
