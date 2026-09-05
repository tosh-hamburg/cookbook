/**
 * Öffentliche Adressen des MCP-Servers.
 *
 * Alles liegt unter `/mcp` auf derselben Domain wie die Website
 * (https://cookbook.gout-diary.com/mcp). Das hat zwei Gründe:
 *
 * 1. Die Anmeldeseite läuft damit auf derselben Origin wie die Website —
 *    die vorhandene Google-Client-ID braucht keine zusätzliche
 *    JavaScript-Origin.
 * 2. Es ist keine eigene Subdomain und kein eigenes Zertifikat nötig; der
 *    Vite-Dev-Server des Frontends leitet `/mcp` an den MCP-Container weiter.
 *
 * Die beiden `.well-known`-Dokumente müssen laut RFC 8414 und RFC 9728 im Root
 * liegen und werden deshalb ebenfalls durchgereicht.
 */

/** Pfad, unter dem der Server eingehängt ist. Muss zur Proxy-Regel passen. */
export const MCP_PATH = '/mcp';

export interface PublicUrls {
  /** Aussteller der Token — der Domain-Root. */
  issuer: string;
  /** Die geschützte Ressource, also der MCP-Endpunkt selbst. */
  resource: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint: string;
  revocationEndpoint: string;
  /** Seite mit dem "Mit Google anmelden"-Knopf. */
  loginPage: string;
  /** Ziel des WWW-Authenticate-Headers bei 401. */
  protectedResourceMetadataUrl: string;
}

/**
 * Leitet alle öffentlichen Adressen aus der Basis-URL ab.
 *
 * @param publicUrl Basis ohne Pfad, z. B. `https://cookbook.gout-diary.com`.
 */
export function buildPublicUrls(publicUrl: string): PublicUrls {
  const origin = new URL(publicUrl).origin;
  const base = `${origin}${MCP_PATH}`;

  return {
    issuer: origin,
    resource: base,
    authorizationEndpoint: `${base}/authorize`,
    tokenEndpoint: `${base}/token`,
    registrationEndpoint: `${base}/register`,
    revocationEndpoint: `${base}/revoke`,
    loginPage: `${base}/login`,
    protectedResourceMetadataUrl: `${origin}/.well-known/oauth-protected-resource${MCP_PATH}`,
  };
}
