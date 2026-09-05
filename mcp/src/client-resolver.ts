import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { CookbookApiClient, type ApiEndpoint, type Fetch } from './api/client.js';
import type { OAuthStore } from './oauth/store.js';

/**
 * Ermittelt den API-Client für einen Werkzeugaufruf.
 *
 * Beim stdio-Transport ist das immer derselbe Client mit den Zugangsdaten aus
 * der Konfiguration. Beim HTTP-Transport bringt jede Anfrage über OAuth die
 * Identität ihrer Person mit — der Client wird dann aus deren Kochbuch-JWT
 * gebaut, damit Rechte und Eigentümerschaft stimmen.
 */

/** Ausschnitt aus `RequestHandlerExtra`, den die Werkzeuge tatsächlich brauchen. */
export interface ToolExtra {
  authInfo?: AuthInfo;
}

export type ClientResolver = (extra: ToolExtra) => CookbookApiClient;

/** Immer derselbe Client — für den stdio-Transport. */
export function staticClientResolver(client: CookbookApiClient): ClientResolver {
  return () => client;
}

export interface SessionResolverOptions {
  endpoint: ApiEndpoint;
  store: OAuthStore;
  fetchImpl?: Fetch;
}

/**
 * Baut je Aufruf einen Client aus dem Kochbuch-JWT der angemeldeten Person.
 *
 * Erneuert der Client das Token unterwegs, wandert der neue Wert zurück in die
 * Sitzung — sonst müsste sich die Person nach sieben Tagen neu anmelden.
 */
export function sessionClientResolver(options: SessionResolverOptions): ClientResolver {
  return (extra) => {
    const info = extra.authInfo?.extra;
    const cookbookToken = typeof info?.cookbookToken === 'string' ? info.cookbookToken : undefined;
    const sessionId = typeof info?.sessionId === 'string' ? info.sessionId : undefined;

    if (!cookbookToken || !sessionId) {
      // Kann nur passieren, wenn der Endpunkt ohne Bearer-Prüfung eingehängt
      // wurde — dann lieber hart scheitern als anonym schreiben.
      throw new Error('Kein angemeldetes Kochbuch-Konto in der Anfrage. Bitte in Claude neu verbinden.');
    }

    return new CookbookApiClient(
      {
        apiUrl: options.endpoint.apiUrl,
        timeoutMs: options.endpoint.timeoutMs,
        credentials: {
          kind: 'session',
          token: cookbookToken,
          onTokenRefreshed: (token) => options.store.updateCookbookToken(sessionId, token),
        },
      },
      options.fetchImpl,
    );
  };
}
