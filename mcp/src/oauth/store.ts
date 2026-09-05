import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';

/**
 * Dateigestützter Speicher für den OAuth-Server.
 *
 * Er hält registrierte Claude-Clients, laufende Anmeldungen und ausgestellte
 * Sitzungen. Die Daten müssen einen Neustart des Containers überstehen, sonst
 * müsste sich nach jedem Deploy jede Person neu anmelden.
 *
 * Der Umfang ist klein (ein Haushalt), deshalb reicht eine JSON-Datei, die
 * vollständig im Speicher gehalten und bei jeder Änderung atomar geschrieben
 * wird. Token stehen nur als SHA-256-Hash in der Datei: Wer sie liest, kann
 * damit keine Anfragen stellen.
 *
 * Achtung: Die Kochbuch-JWTs der angemeldeten Personen stehen im Klartext
 * darin — sie müssen zum Aufruf der API verwendbar bleiben. Die Datei ist
 * daher genauso schützenswert wie ein Passwort und wird mit 0600 angelegt.
 */

export interface PendingLogin {
  /** Zufälliges Kennzeichen, das die Login-Seite mit sich führt. */
  ticket: string;
  /**
   * Hash eines Cookies, das beim Start der Autorisierung gesetzt wurde.
   *
   * Bindet die Anmeldung an genau den Browser, in dem Claude sie gestartet hat.
   * Ohne diese Bindung könnte jemand einen eigenen Client registrieren und den
   * fertigen Anmeldelink an eine andere Person schicken; meldet die sich an,
   * bekäme der Absender einen Code für deren Konto.
   */
  browserBindingHash: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  state?: string;
  resource?: string;
  expiresAt: number;
  /** Nach erfolgreicher Google-Anmeldung gesetzt, vor der Einwilligung. */
  verified?: {
    userId: string;
    username: string;
    cookbookToken: string;
  };
}

export interface AuthorizationCode {
  /** Hash des Codes. */
  codeHash: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource?: string;
  userId: string;
  username: string;
  cookbookToken: string;
  expiresAt: number;
}

export interface Session {
  id: string;
  clientId: string;
  scopes: string[];
  resource?: string;
  userId: string;
  username: string;
  /** Kochbuch-JWT der angemeldeten Person. */
  cookbookToken: string;
  accessTokenHash: string;
  accessTokenExpiresAt: number;
  refreshTokenHash: string;
  refreshTokenExpiresAt: number;
}

interface StoreData {
  clients: Record<string, OAuthClientInformationFull>;
  pendingLogins: Record<string, PendingLogin>;
  authorizationCodes: Record<string, AuthorizationCode>;
  sessions: Record<string, Session>;
}

const EMPTY: StoreData = { clients: {}, pendingLogins: {}, authorizationCodes: {}, sessions: {} };

/** Erzeugt ein zufälliges, URL-sicheres Geheimnis. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256-Hash als Hex — für die Ablage von Token. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class OAuthStore {
  private readonly file: string;
  private readonly now: () => number;
  private data: StoreData = structuredClone(EMPTY);
  private writeChain: Promise<void> = Promise.resolve();

  /**
   * @param now Zeitquelle. Muss dieselbe sein wie im Provider, sonst können
   *   Ablaufprüfungen auseinanderlaufen; injizierbar für Tests.
   */
  constructor(dataDir: string, now: () => number = Date.now) {
    this.file = path.join(dataDir, 'oauth.json');
    this.now = now;
  }

  /** Lädt den Bestand von der Platte. Fehlt die Datei, startet der Speicher leer. */
  async load(): Promise<void> {
    try {
      const raw = await readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoreData>;
      this.data = { ...structuredClone(EMPTY), ...parsed };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`OAuth-Speicher ${this.file} ist nicht lesbar: ${(error as Error).message}`);
      }
    }
    await this.purgeExpired();
  }

  // ------------------------------------------------------------ Clients

  getClient(clientId: string): OAuthClientInformationFull | undefined {
    return this.data.clients[clientId];
  }

  async saveClient(client: OAuthClientInformationFull): Promise<void> {
    this.data.clients[client.client_id] = client;
    await this.persist();
  }

  // ------------------------------------------------- laufende Anmeldungen

  /** Legt eine Anmeldung an oder aktualisiert sie, ohne sie zu verbrauchen. */
  async savePendingLogin(login: PendingLogin): Promise<void> {
    this.data.pendingLogins[login.ticket] = login;
    await this.persist();
  }

  /** Holt eine laufende Anmeldung und entfernt sie — ein Ticket gilt nur einmal. */
  async takePendingLogin(ticket: string): Promise<PendingLogin | undefined> {
    const login = this.data.pendingLogins[ticket];
    if (!login) return undefined;
    delete this.data.pendingLogins[ticket];
    await this.persist();
    return login.expiresAt > this.now() ? login : undefined;
  }

  /** Liest eine laufende Anmeldung, ohne sie zu verbrauchen (für die Login-Seite). */
  peekPendingLogin(ticket: string): PendingLogin | undefined {
    const login = this.data.pendingLogins[ticket];
    return login && login.expiresAt > this.now() ? login : undefined;
  }

  // ------------------------------------------------- Autorisierungscodes

  async saveAuthorizationCode(code: AuthorizationCode): Promise<void> {
    this.data.authorizationCodes[code.codeHash] = code;
    await this.persist();
  }

  peekAuthorizationCode(code: string): AuthorizationCode | undefined {
    const entry = this.data.authorizationCodes[hashToken(code)];
    return entry && entry.expiresAt > this.now() ? entry : undefined;
  }

  /** Löst einen Code ein. Ein Code lässt sich nur ein einziges Mal tauschen. */
  async takeAuthorizationCode(code: string): Promise<AuthorizationCode | undefined> {
    const key = hashToken(code);
    const entry = this.data.authorizationCodes[key];
    if (!entry) return undefined;
    delete this.data.authorizationCodes[key];
    await this.persist();
    return entry.expiresAt > this.now() ? entry : undefined;
  }

  // ------------------------------------------------------------ Sitzungen

  async saveSession(session: Session): Promise<void> {
    this.data.sessions[session.id] = session;
    await this.persist();
  }

  findSessionByAccessToken(token: string): Session | undefined {
    const hash = hashToken(token);
    return Object.values(this.data.sessions).find((session) => session.accessTokenHash === hash);
  }

  findSessionByRefreshToken(token: string): Session | undefined {
    const hash = hashToken(token);
    return Object.values(this.data.sessions).find((session) => session.refreshTokenHash === hash);
  }

  async deleteSession(id: string): Promise<void> {
    delete this.data.sessions[id];
    await this.persist();
  }

  /** Entfernt eine Sitzung anhand eines Access- oder Refresh-Tokens. */
  async deleteSessionByToken(token: string): Promise<boolean> {
    const session = this.findSessionByAccessToken(token) ?? this.findSessionByRefreshToken(token);
    if (!session) return false;
    await this.deleteSession(session.id);
    return true;
  }

  /** Speichert ein erneuertes Kochbuch-JWT in der Sitzung. */
  async updateCookbookToken(sessionId: string, cookbookToken: string): Promise<void> {
    const session = this.data.sessions[sessionId];
    if (!session) return;
    this.data.sessions[sessionId] = { ...session, cookbookToken };
    await this.persist();
  }

  // ------------------------------------------------------------- Wartung

  /** Wirft abgelaufene Anmeldungen, Codes und Sitzungen weg. */
  async purgeExpired(now = this.now()): Promise<number> {
    let removed = 0;
    for (const [key, entry] of Object.entries(this.data.pendingLogins)) {
      if (entry.expiresAt <= now) {
        delete this.data.pendingLogins[key];
        removed += 1;
      }
    }
    for (const [key, entry] of Object.entries(this.data.authorizationCodes)) {
      if (entry.expiresAt <= now) {
        delete this.data.authorizationCodes[key];
        removed += 1;
      }
    }
    for (const [key, session] of Object.entries(this.data.sessions)) {
      // Erst wenn auch das Refresh-Token abgelaufen ist, ist die Sitzung tot.
      if (session.refreshTokenExpiresAt <= now) {
        delete this.data.sessions[key];
        removed += 1;
      }
    }
    if (removed > 0) {
      await this.persist();
    }
    return removed;
  }

  /** Nur für Tests und Diagnose. */
  counts(): { clients: number; pendingLogins: number; authorizationCodes: number; sessions: number } {
    return {
      clients: Object.keys(this.data.clients).length,
      pendingLogins: Object.keys(this.data.pendingLogins).length,
      authorizationCodes: Object.keys(this.data.authorizationCodes).length,
      sessions: Object.keys(this.data.sessions).length,
    };
  }

  /**
   * Schreibt den Bestand atomar: erst in eine temporäre Datei, dann umbenennen.
   *
   * Schreibvorgänge laufen der Reihe nach, damit sich parallele Anfragen nicht
   * gegenseitig überschreiben. Ein Fehler wird an den Aufrufer weitergereicht —
   * sonst hielte der sich für gespeichert, und die Sitzung wäre nach dem
   * nächsten Neustart verschwunden. Die Kette selbst bleibt benutzbar.
   */
  private persist(): Promise<void> {
    const next = this.writeChain.then(
      () => this.writeNow(),
      () => this.writeNow(),
    );
    this.writeChain = next.catch(() => undefined);
    return next;
  }

  private async writeNow(): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const temp = `${this.file}.${randomToken(6)}.tmp`;
    await writeFile(temp, JSON.stringify(this.data, null, 2), { encoding: 'utf8', mode: 0o600 });
    await rename(temp, this.file);
  }
}
