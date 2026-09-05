/** Fehler einer HTTP-Antwort der Kochbuch-API. */
export class ApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(status: number, path: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.path = path;
  }

  /** Für den Menschen verständliche Meldung inkl. Deutung typischer Statuscodes. */
  toUserMessage(): string {
    switch (this.status) {
      case 401:
        return `Nicht authentifiziert (${this.path}): ${this.message}. Bitte COOKBOOK_TOKEN bzw. COOKBOOK_USERNAME/COOKBOOK_PASSWORD prüfen.`;
      case 403:
        return `Keine Berechtigung (${this.path}): ${this.message}. Nur Eigentümer bzw. Admins dürfen diese Aktion ausführen.`;
      case 404:
        return `Nicht gefunden (${this.path}): ${this.message}`;
      case 429:
        return `Zu viele Anfragen an die Kochbuch-API (${this.path}): ${this.message}. Bitte kurz warten.`;
      default:
        return `Kochbuch-API antwortete mit HTTP ${this.status} (${this.path}): ${this.message}`;
    }
  }
}

/** Fehler beim Aufbau der Verbindung (DNS, Timeout, TLS …). */
export class ApiConnectionError extends Error {
  constructor(url: string, cause: unknown) {
    super(`Kochbuch-API unter ${url} nicht erreichbar: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'ApiConnectionError';
    this.cause = cause;
  }
}

/** Login schlug fehl, weil das Konto 2FA verlangt. */
export class TwoFactorRequiredError extends Error {
  constructor() {
    super(
      'Für dieses Konto ist Zwei-Faktor-Authentifizierung aktiv — Login mit Benutzername/Passwort ist ' +
        'daher nicht möglich. Stattdessen COOKBOOK_TOKEN mit einem gültigen JWT setzen.',
    );
    this.name = 'TwoFactorRequiredError';
  }
}
