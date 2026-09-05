import { z } from 'zod';

/**
 * Laufzeit-Konfiguration des MCP-Servers.
 *
 * Alle Werte kommen aus Umgebungsvariablen — beim stdio-Transport aus dem
 * `env`-Block der Claude-MCP-Konfiguration, beim HTTP-Transport aus
 * docker-compose bzw. der .env-Datei.
 *
 * Die beiden Transporte authentifizieren unterschiedlich:
 * • stdio  — ein festes Konto aus der Konfiguration (COOKBOOK_TOKEN oder
 *            COOKBOOK_USERNAME/COOKBOOK_PASSWORD).
 * • http   — OAuth: Jede Person meldet sich mit ihrem Google-Konto an, genau
 *            wie auf der Website. Der Server selbst kennt keine Zugangsdaten.
 */

const TRANSPORTS = ['stdio', 'http'] as const;

const nonEmpty = z.string().trim().min(1);

/** Origins der Claude-Clients, die keinen Loopback-Rückkanal verwenden. */
const DEFAULT_REDIRECT_ORIGINS = ['https://claude.ai', 'https://claude.com'];

const rawSchema = z.object({
  COOKBOOK_API_URL: nonEmpty.describe('Basis-URL der Kochbuch-API, z. B. https://api.cookbook.gout-diary.com'),
  COOKBOOK_TOKEN: nonEmpty.optional(),
  COOKBOOK_USERNAME: nonEmpty.optional(),
  COOKBOOK_PASSWORD: nonEmpty.optional(),
  COOKBOOK_TIMEOUT_MS: z.coerce.number().int().positive().max(300_000).default(30_000),
  MCP_TRANSPORT: z.enum(TRANSPORTS).default('stdio'),
  MCP_HTTP_HOST: nonEmpty.default('0.0.0.0'),
  MCP_HTTP_PORT: z.coerce.number().int().min(1).max(65_535).default(4003),
  MCP_PUBLIC_URL: nonEmpty.optional(),
  MCP_DATA_DIR: nonEmpty.default('./.data'),
  MCP_ALLOWED_REDIRECT_ORIGINS: z.string().trim().optional(),
  GOOGLE_CLIENT_ID: nonEmpty.optional(),
});

export type Transport = (typeof TRANSPORTS)[number];

export type Credentials =
  | { kind: 'token'; token: string }
  | { kind: 'password'; username: string; password: string }
  /** Token einer angemeldeten Person; wird über /api/auth/refresh erneuert. */
  | { kind: 'session'; token: string; onTokenRefreshed?: (token: string) => void | Promise<void> };

export interface HttpConfig {
  host: string;
  port: number;
  /** Öffentliche Basis-URL, unter der Claude den Server erreicht (ohne Pfad). */
  publicUrl: string;
  /** Dieselbe Client-ID, die auch die Website für "Mit Google anmelden" nutzt. */
  googleClientId: string;
  /** Verzeichnis für Clients, Sitzungen und Autorisierungscodes. */
  dataDir: string;
  /**
   * Origins, an die ein Autorisierungscode zurückgegeben werden darf.
   *
   * Loopback-Adressen sind immer erlaubt (dort läuft der Rückkanal lokal
   * gestarteter Clients). Alles andere muss hier stehen — sonst könnte sich
   * jemand einen eigenen Client registrieren und Codes auf einen fremden
   * Server umleiten.
   */
  allowedRedirectOrigins: string[];
}

export interface Config {
  apiUrl: string;
  timeoutMs: number;
  transport: Transport;
  /** Nur beim stdio-Transport gesetzt. */
  credentials: Credentials | null;
  /** Nur beim HTTP-Transport gesetzt. */
  http: HttpConfig | null;
}

/** Entfernt einen abschließenden Slash, damit `${apiUrl}/api/...` immer stimmt. */
function normalizeHttpUrl(value: string, variable: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Ungültige Konfiguration: ${variable} ist keine gültige URL: ${value}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Ungültige Konfiguration: ${variable} muss http(s) sein, war: ${url.protocol}`);
  }
  return value.replace(/\/+$/, '');
}

/**
 * Liest und validiert die Konfiguration.
 *
 * @throws Error mit einer für Menschen lesbaren Liste aller Fehler.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = rawSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
    throw new Error(`Ungültige Konfiguration:\n${details}`);
  }

  const raw = parsed.data;
  const apiUrl = normalizeHttpUrl(raw.COOKBOOK_API_URL, 'COOKBOOK_API_URL');

  const base = { apiUrl, timeoutMs: raw.COOKBOOK_TIMEOUT_MS, transport: raw.MCP_TRANSPORT };

  if (raw.MCP_TRANSPORT === 'http') {
    return { ...base, credentials: null, http: resolveHttpConfig(raw) };
  }

  return { ...base, credentials: resolveCredentials(raw), http: null };
}

function resolveHttpConfig(raw: z.infer<typeof rawSchema>): HttpConfig {
  if (!raw.MCP_PUBLIC_URL) {
    throw new Error(
      'Ungültige Konfiguration: MCP_PUBLIC_URL ist beim HTTP-Transport erforderlich — ' +
        'die OAuth-Metadaten müssen die öffentliche Adresse nennen, z. B. https://cookbook.gout-diary.com',
    );
  }
  if (!raw.GOOGLE_CLIENT_ID) {
    throw new Error(
      'Ungültige Konfiguration: GOOGLE_CLIENT_ID ist beim HTTP-Transport erforderlich — ' +
        'die Anmeldung läuft über Google, mit derselben Client-ID wie die Website.',
    );
  }

  const publicUrl = normalizeHttpUrl(raw.MCP_PUBLIC_URL, 'MCP_PUBLIC_URL');
  const parsed = new URL(publicUrl);

  // OAuth verlangt HTTPS; für lokale Tests ist Loopback ausgenommen.
  const isLoopback = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !isLoopback) {
    throw new Error(
      `Ungültige Konfiguration: MCP_PUBLIC_URL muss https sein (Ausnahme: localhost), war: ${publicUrl}`,
    );
  }
  if (parsed.pathname !== '/') {
    throw new Error(
      `Ungültige Konfiguration: MCP_PUBLIC_URL darf keinen Pfad enthalten (der Pfad /mcp kommt automatisch), war: ${publicUrl}`,
    );
  }

  return {
    host: raw.MCP_HTTP_HOST,
    port: raw.MCP_HTTP_PORT,
    publicUrl,
    googleClientId: raw.GOOGLE_CLIENT_ID,
    dataDir: raw.MCP_DATA_DIR,
    allowedRedirectOrigins: parseRedirectOrigins(raw.MCP_ALLOWED_REDIRECT_ORIGINS),
  };
}

function parseRedirectOrigins(value: string | undefined): string[] {
  if (!value) return DEFAULT_REDIRECT_ORIGINS;

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      let url: URL;
      try {
        url = new URL(entry);
      } catch {
        throw new Error(`Ungültige Konfiguration: MCP_ALLOWED_REDIRECT_ORIGINS enthält keine gültige URL: ${entry}`);
      }
      return url.origin;
    });
}

function resolveCredentials(raw: z.infer<typeof rawSchema>): Credentials {
  if (raw.COOKBOOK_TOKEN) {
    return { kind: 'token', token: raw.COOKBOOK_TOKEN };
  }
  if (raw.COOKBOOK_USERNAME && raw.COOKBOOK_PASSWORD) {
    return { kind: 'password', username: raw.COOKBOOK_USERNAME, password: raw.COOKBOOK_PASSWORD };
  }
  throw new Error(
    'Ungültige Konfiguration: Beim stdio-Transport müssen entweder COOKBOOK_TOKEN oder ' +
      'COOKBOOK_USERNAME und COOKBOOK_PASSWORD gesetzt sein.',
  );
}
