import type { Response } from 'express';
import type { AuthorizationParams, OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import {
  AccessDeniedError,
  InvalidClientMetadataError,
  InvalidGrantError,
  InvalidRequestError,
  InvalidTokenError,
  ServerError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { exchangeGoogleCredential, refreshCookbookToken, type ApiEndpoint, type Fetch } from '../api/client.js';
import { ApiError } from '../errors.js';
import { hashToken, OAuthStore, randomToken, type PendingLogin, type Session } from './store.js';
import type { PublicUrls } from './urls.js';

/**
 * OAuth-Server für den MCP-Endpunkt.
 *
 * Claude registriert sich selbst, schickt die Person zur Anmeldung in den
 * Browser, und diese meldet sich dort mit ihrem Google-Konto an — genau wie auf
 * der Website. Der Server tauscht das Google-ID-Token beim Backend gegen ein
 * Kochbuch-JWT und legt es in der Sitzung ab. Jeder Werkzeugaufruf läuft danach
 * unter dem Konto der angemeldeten Person, mit deren Rechten.
 *
 * Die Anmeldung ist bewusst zweistufig: erst Google, dann eine ausdrückliche
 * Einwilligung, die zeigt, wer den Zugriff bekommt und wohin der Code geht.
 */

/** Gültigkeitsdauern. */
export const TICKET_TTL_MS = 15 * 60 * 1000;
export const CODE_TTL_MS = 5 * 60 * 1000;
export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
/** Passt zur 30-Tage-Kulanz von POST /api/auth/refresh im Backend. */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Name des Cookies, das eine Anmeldung an einen Browser bindet. */
export const BINDING_COOKIE = 'cookbook_mcp_login';

export interface ProviderOptions {
  store: OAuthStore;
  endpoint: ApiEndpoint;
  urls: PublicUrls;
  /** Nicht-Loopback-Origins, an die ein Code zurückgegeben werden darf. */
  allowedRedirectOrigins: string[];
  fetchImpl?: Fetch;
  now?: () => number;
}

/** Was die Anmeldeseite nach erfolgreicher Google-Anmeldung anzeigt. */
export interface LoginVerification {
  username: string;
  clientName: string;
  /** Host, an den der Autorisierungscode geht — der springende Punkt der Einwilligung. */
  redirectHost: string;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Prüft, ob eine Rücksprungadresse zulässig ist.
 *
 * Loopback ist immer erlaubt: Dort landet der Code auf dem Rechner der Person
 * selbst. Alles andere muss ausdrücklich freigegeben sein, sonst könnte sich
 * jemand einen Client mit beliebiger Rücksprungadresse registrieren.
 */
export function isAllowedRedirectUri(uri: string, allowedOrigins: readonly string[]): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)) {
    return true;
  }
  if (url.protocol !== 'https:') {
    return false;
  }
  return allowedOrigins.includes(url.origin);
}

export class CookbookOAuthProvider implements OAuthServerProvider {
  readonly clientsStore: OAuthRegisteredClientsStore;
  private readonly store: OAuthStore;
  private readonly endpoint: ApiEndpoint;
  private readonly urls: PublicUrls;
  private readonly allowedRedirectOrigins: string[];
  private readonly fetchImpl: Fetch;
  private readonly now: () => number;

  constructor(options: ProviderOptions) {
    this.store = options.store;
    this.endpoint = options.endpoint;
    this.urls = options.urls;
    this.allowedRedirectOrigins = options.allowedRedirectOrigins;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.now = options.now ?? Date.now;

    this.clientsStore = {
      getClient: (clientId) => this.store.getClient(clientId),
      registerClient: async (client) => {
        const full = client as OAuthClientInformationFull;
        const verboten = full.redirect_uris.filter((uri) => !isAllowedRedirectUri(uri, this.allowedRedirectOrigins));
        if (verboten.length > 0) {
          throw new InvalidClientMetadataError(
            `Unzulässige redirect_uri: ${verboten.join(', ')}. Erlaubt sind Loopback-Adressen ` +
              `(http://127.0.0.1:…) sowie ${this.allowedRedirectOrigins.join(', ') || '— keine weiteren Origins'}.`,
          );
        }
        await this.store.saveClient(full);
        return full;
      },
    };
  }

  /**
   * Erster Schritt: Die Anfrage wird gemerkt, an den Browser gebunden und
   * dieser zur Anmeldeseite geschickt.
   */
  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    // Zweite Verteidigungslinie: Der SDK-Handler prüft nur, ob die Adresse
    // registriert ist — nicht, ob sie unserer Richtlinie entspricht.
    if (!isAllowedRedirectUri(params.redirectUri, this.allowedRedirectOrigins)) {
      throw new InvalidRequestError('Diese Rücksprungadresse ist nicht zugelassen');
    }

    const ticket = randomToken();
    const binding = randomToken();

    await this.store.savePendingLogin({
      ticket,
      browserBindingHash: hashToken(binding),
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      scopes: params.scopes ?? [],
      state: params.state,
      resource: params.resource?.href,
      expiresAt: this.now() + TICKET_TTL_MS,
    });

    res.cookie(BINDING_COOKIE, binding, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.urls.issuer.startsWith('https:'),
      path: '/mcp',
      maxAge: TICKET_TTL_MS,
    });

    const target = new URL(this.urls.loginPage);
    target.searchParams.set('ticket', ticket);
    res.redirect(302, target.href);
  }

  /** Liest eine laufende Anmeldung und prüft die Browser-Bindung. */
  requirePendingLogin(ticket: string, binding: string | undefined): PendingLogin {
    const pending = this.store.peekPendingLogin(ticket);
    if (!pending) {
      throw new InvalidRequestError('Die Anmeldung ist abgelaufen. Bitte in Claude erneut verbinden.');
    }
    if (!binding || hashToken(binding) !== pending.browserBindingHash) {
      throw new InvalidRequestError(
        'Diese Anmeldung wurde in einem anderen Browser begonnen. Bitte die Verbindung in Claude neu starten.',
      );
    }
    return pending;
  }

  /**
   * Zweiter Schritt: Das Google-ID-Token wird beim Backend gegen ein
   * Kochbuch-JWT getauscht. Der Autorisierungscode entsteht dabei noch nicht —
   * dafür braucht es die ausdrückliche Einwilligung in {@link approveLogin}.
   */
  async verifyLogin(ticket: string, binding: string | undefined, googleCredential: string): Promise<LoginVerification> {
    const pending = this.requirePendingLogin(ticket, binding);

    let identity: { token: string; user: { id: string; username: string } };
    try {
      identity = await exchangeGoogleCredential(this.endpoint, googleCredential, this.fetchImpl);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        // Häufigster Fall: Das Google-Konto gehört zu keinem Kochbuch-Benutzer.
        throw new AccessDeniedError(error.message);
      }
      throw new ServerError(error instanceof Error ? error.message : String(error));
    }

    // Das Ticket bleibt bestehen; verbraucht wird es erst bei der Einwilligung.
    // So kostet ein Netzwerkfehler nicht den ganzen Anmeldevorgang.
    await this.store.savePendingLogin({
      ...pending,
      verified: { userId: identity.user.id, username: identity.user.username, cookbookToken: identity.token },
    });

    const client = this.store.getClient(pending.clientId);
    return {
      username: identity.user.username,
      clientName: client?.client_name ?? 'Unbekannte Anwendung',
      redirectHost: new URL(pending.redirectUri).host,
    };
  }

  /**
   * Dritter Schritt: Die Person willigt ein. Erst jetzt entsteht der
   * Autorisierungscode.
   *
   * @returns Die URL, auf die der Browser weitergeleitet werden muss.
   */
  async approveLogin(ticket: string, binding: string | undefined): Promise<string> {
    const pending = this.requirePendingLogin(ticket, binding);
    if (!pending.verified) {
      throw new InvalidRequestError('Es liegt keine abgeschlossene Google-Anmeldung vor.');
    }

    await this.store.takePendingLogin(ticket);

    const code = randomToken();
    await this.store.saveAuthorizationCode({
      codeHash: hashToken(code),
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      codeChallenge: pending.codeChallenge,
      scopes: pending.scopes,
      resource: pending.resource,
      userId: pending.verified.userId,
      username: pending.verified.username,
      cookbookToken: pending.verified.cookbookToken,
      expiresAt: this.now() + CODE_TTL_MS,
    });

    return this.buildRedirect(pending, { code });
  }

  /** Die Person lehnt ab: Die Anmeldung wird verworfen und der Client informiert. */
  async denyLogin(ticket: string, binding: string | undefined): Promise<string> {
    const pending = this.requirePendingLogin(ticket, binding);
    await this.store.takePendingLogin(ticket);
    return this.buildRedirect(pending, { error: 'access_denied', error_description: 'Zugriff abgelehnt' });
  }

  private buildRedirect(pending: PendingLogin, params: Record<string, string>): string {
    const redirect = new URL(pending.redirectUri);
    for (const [key, value] of Object.entries(params)) {
      redirect.searchParams.set(key, value);
    }
    if (pending.state !== undefined) {
      redirect.searchParams.set('state', pending.state);
    }
    return redirect.href;
  }

  /** Wird vom Token-Endpunkt für die PKCE-Prüfung aufgerufen. */
  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const entry = this.store.peekAuthorizationCode(authorizationCode);
    if (!entry || entry.clientId !== client.client_id) {
      throw new InvalidGrantError('Unbekannter oder abgelaufener Autorisierungscode');
    }
    return entry.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
  ): Promise<OAuthTokens> {
    const entry = await this.store.takeAuthorizationCode(authorizationCode);
    if (!entry || entry.clientId !== client.client_id) {
      throw new InvalidGrantError('Unbekannter oder abgelaufener Autorisierungscode');
    }
    // RFC 6749 §4.1.3: Die Adresse muss mitgeschickt werden und übereinstimmen,
    // wenn sie schon bei der Autorisierung dabei war — das ist hier immer der Fall.
    if (redirectUri !== entry.redirectUri) {
      throw new InvalidGrantError('redirect_uri fehlt oder stimmt nicht mit der Autorisierung überein');
    }

    return this.issueTokens({
      id: randomToken(12),
      clientId: entry.clientId,
      scopes: entry.scopes,
      resource: entry.resource,
      userId: entry.userId,
      username: entry.username,
      cookbookToken: entry.cookbookToken,
    });
  }

  /**
   * Tauscht ein Refresh-Token gegen frische Token.
   *
   * Dabei wird auch das Kochbuch-JWT erneuert. Es gilt nur sieben Tage; ohne
   * diese Auffrischung wäre eine Sitzung nach einer Woche wertlos, obwohl das
   * Refresh-Token noch gültig ist.
   */
  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string): Promise<OAuthTokens> {
    const session = this.store.findSessionByRefreshToken(refreshToken);
    if (!session || session.clientId !== client.client_id) {
      throw new InvalidGrantError('Unbekanntes Refresh-Token');
    }
    if (session.refreshTokenExpiresAt <= this.now()) {
      await this.store.deleteSession(session.id);
      throw new InvalidGrantError('Refresh-Token abgelaufen. Bitte neu anmelden.');
    }

    let cookbookToken: string;
    try {
      cookbookToken = await refreshCookbookToken(this.endpoint, session.cookbookToken, this.fetchImpl);
    } catch (error) {
      // Nur eine echte Ablehnung beendet die Sitzung: Konto gelöscht oder die
      // 30-Tage-Kulanz überschritten. Ein Netzwerkfehler oder ein kurzer
      // Backend-Neustart darf NICHT alle Angemeldeten hinauswerfen — sonst
      // genügt ein Deploy zur Unzeit, um jede aktive Sitzung zu beenden.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await this.store.deleteSession(session.id);
        throw new InvalidGrantError(
          `Die Kochbuch-Sitzung ist abgelaufen und ließ sich nicht erneuern (${error.message}). Bitte neu anmelden.`,
        );
      }
      throw new ServerError(
        `Die Kochbuch-API ist gerade nicht erreichbar (${
          error instanceof Error ? error.message : String(error)
        }). Die Sitzung bleibt bestehen, bitte später erneut versuchen.`,
      );
    }

    return this.issueTokens({ ...session, cookbookToken });
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const session = this.store.findSessionByAccessToken(token);
    if (!session) {
      throw new InvalidTokenError('Unbekanntes Token');
    }
    if (session.accessTokenExpiresAt <= this.now()) {
      throw new InvalidTokenError('Token abgelaufen');
    }

    return {
      token,
      clientId: session.clientId,
      scopes: session.scopes,
      expiresAt: Math.floor(session.accessTokenExpiresAt / 1000),
      resource: session.resource ? new URL(session.resource) : undefined,
      extra: {
        sessionId: session.id,
        userId: session.userId,
        username: session.username,
        cookbookToken: session.cookbookToken,
      },
    };
  }

  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    const session =
      this.store.findSessionByAccessToken(request.token) ?? this.store.findSessionByRefreshToken(request.token);

    // RFC 7009 §2.1: Ein Client darf nur seine eigenen Token widerrufen. Ein
    // unbekanntes Token ist ausdrücklich kein Fehler.
    if (session && session.clientId === client.client_id) {
      await this.store.deleteSession(session.id);
    }
  }

  /** Legt eine Sitzung an bzw. erneuert sie und gibt die Token zurück. */
  private async issueTokens(
    base: Pick<Session, 'id' | 'clientId' | 'scopes' | 'resource' | 'userId' | 'username' | 'cookbookToken'>,
  ): Promise<OAuthTokens> {
    const accessToken = randomToken();
    const refreshToken = randomToken();
    const issuedAt = this.now();

    await this.store.saveSession({
      ...base,
      accessTokenHash: hashToken(accessToken),
      accessTokenExpiresAt: issuedAt + ACCESS_TOKEN_TTL_MS,
      refreshTokenHash: hashToken(refreshToken),
      refreshTokenExpiresAt: issuedAt + REFRESH_TOKEN_TTL_MS,
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      refresh_token: refreshToken,
      scope: base.scopes.join(' ') || undefined,
    };
  }
}
