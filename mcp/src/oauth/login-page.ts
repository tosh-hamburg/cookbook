/**
 * Anmeldeseite für den OAuth-Fluss.
 *
 * Sie nutzt dieselbe Technik wie die Website: Google Identity Services liefert
 * im Browser ein ID-Token, das der Server anschließend beim Backend gegen ein
 * Kochbuch-JWT tauscht. Weil die Seite unter derselben Domain wie die Website
 * ausgeliefert wird, ist die vorhandene Client-ID bereits für diese Origin
 * freigegeben — in der Google Cloud Console ist nichts zu ändern.
 *
 * Der Ablauf ist bewusst zweistufig. Nach der Google-Anmeldung erscheint eine
 * Einwilligung, die Namen und Rücksprungziel der anfragenden Anwendung nennt.
 * Ohne diesen Schritt könnte jemand einen eigenen Client registrieren und den
 * fertigen Anmeldelink verschicken — wer sich dann anmeldet, gäbe still Zugriff
 * auf sein Kochbuch.
 */

export interface LoginPageOptions {
  ticket: string;
  googleClientId: string;
  /** Basispfad der Anmelde-Endpunkte, z. B. `/mcp/login`. */
  loginPath: string;
  /** Name des Clients, der den Zugriff möchte (aus der Registrierung). */
  clientName?: string;
  /** Zufälliger Wert für die Content-Security-Policy des Inline-Skripts. */
  nonce: string;
}

/** Maskiert Zeichen, die HTML-Struktur erzeugen könnten. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Content-Security-Policy der Anmeldeseite.
 *
 * Die Herkünfte sind die von Google für Identity Services dokumentierten.
 * `form-action 'none'` ist unkritisch, weil die Seite kein Formular abschickt,
 * sondern per JavaScript weiterleitet.
 */
export function loginPageCsp(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' https://accounts.google.com/gsi/client https://accounts.google.com/gsi/`,
    "style-src 'unsafe-inline' https://accounts.google.com/gsi/style",
    "connect-src 'self' https://accounts.google.com/gsi/",
    'frame-src https://accounts.google.com/gsi/',
    'img-src https: data:',
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

/** Vollständige HTML-Seite: Google-Anmeldung, danach Einwilligung. */
export function renderLoginPage(options: LoginPageOptions): string {
  const clientId = escapeHtml(options.googleClientId);
  const clientName = escapeHtml(options.clientName ?? 'Eine unbekannte Anwendung');
  const nonce = escapeHtml(options.nonce);

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Kochbuch — Zugriff erlauben</title>
<style>
  :root { color-scheme: light dark; --bg:#faf7f2; --card:#fff; --text:#241f1a; --muted:#6d635a; --line:#e6ded2; --accent:#b4531f; --accent-text:#fff; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#191512; --card:#221d19; --text:#f2ece4; --muted:#a99e92; --line:#3a322b; --accent:#e08a4e; --accent-text:#1a1310; }
  }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px;
         background:var(--bg); color:var(--text);
         font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .card { width:100%; max-width:440px; background:var(--card); border:1px solid var(--line);
          border-radius:16px; padding:32px; box-shadow:0 12px 32px rgba(0,0,0,.08); }
  h1 { margin:0 0 8px; font-size:1.35rem; letter-spacing:-.01em; }
  p { margin:0 0 20px; color:var(--muted); line-height:1.55; font-size:.95rem; }
  .who { color:var(--text); font-weight:600; }
  .signin { display:flex; justify-content:center; min-height:44px; margin:24px 0 8px; }
  dl { margin:0 0 24px; display:grid; grid-template-columns:auto 1fr; gap:8px 16px; font-size:.9rem; }
  dt { color:var(--muted); }
  dd { margin:0; font-weight:600; overflow-wrap:anywhere; }
  .actions { display:flex; gap:12px; }
  button { flex:1; padding:11px 16px; border-radius:999px; border:1px solid var(--line);
           font:inherit; font-weight:600; cursor:pointer; background:transparent; color:var(--text); }
  button.primary { background:var(--accent); border-color:var(--accent); color:var(--accent-text); }
  button:disabled { opacity:.5; cursor:default; }
  .note { margin:20px 0 0; padding-top:16px; border-top:1px solid var(--line); font-size:.82rem; }
  .status { margin-top:16px; font-size:.9rem; min-height:1.2em; }
  .status[data-kind="error"] { color:#c0392b; }
  @media (prefers-color-scheme: dark) { .status[data-kind="error"] { color:#ff8a7a; } }
  .status[data-kind="busy"] { color:var(--muted); }
  [hidden] { display:none !important; }
</style>
</head>
<body>
  <main class="card">
    <section id="step-signin">
      <h1>Zugriff auf dein Kochbuch</h1>
      <p><span class="who">${clientName}</span> möchte in deinem Namen Rezepte lesen und ändern.
         Melde dich zuerst mit demselben Google-Konto an, das du auf der Website verwendest.</p>

      <div id="g_id_onload"
           data-client_id="${clientId}"
           data-callback="onGoogleCredential"
           data-auto_prompt="false"
           data-context="signin"
           data-ux_mode="popup"></div>

      <div class="signin">
        <div class="g_id_signin" data-type="standard" data-theme="outline" data-size="large"
             data-text="signin_with" data-shape="pill" data-locale="de"></div>
      </div>
    </section>

    <section id="step-consent" hidden>
      <h1>Zugriff erlauben?</h1>
      <p>Prüfe, wem du Zugriff gibst. Der Zugriff umfasst Lesen, Anlegen, Ändern und
         Löschen deiner Rezepte.</p>
      <dl>
        <dt>Angemeldet als</dt><dd id="consent-user"></dd>
        <dt>Anwendung</dt><dd id="consent-client"></dd>
        <dt>Antwort geht an</dt><dd id="consent-host"></dd>
      </dl>
      <div class="actions">
        <button type="button" id="deny">Abbrechen</button>
        <button type="button" id="approve" class="primary">Zugriff erlauben</button>
      </div>
    </section>

    <p class="status" id="status" role="status" aria-live="polite"></p>

    <p class="note">Es werden keine Zugangsdaten an die Anwendung weitergegeben.
       Du kannst den Zugriff jederzeit widerrufen, indem du die Verbindung in Claude entfernst.</p>
  </main>

  <script nonce="${nonce}">
    const TICKET = ${JSON.stringify(options.ticket)};
    const LOGIN_PATH = ${JSON.stringify(options.loginPath)};
    const status = document.getElementById('status');
    const stepSignin = document.getElementById('step-signin');
    const stepConsent = document.getElementById('step-consent');

    function show(message, kind) {
      status.textContent = message;
      status.dataset.kind = kind || '';
    }

    async function post(path, body) {
      const response = await fetch(LOGIN_PATH + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(Object.assign({ ticket: TICKET }, body || {})),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error_description || data.error || 'Unerwarteter Fehler');
      }
      return data;
    }

    async function onGoogleCredential(response) {
      show('Anmeldung wird geprüft …', 'busy');
      try {
        const details = await post('/verify', { credential: response.credential });
        document.getElementById('consent-user').textContent = details.username;
        document.getElementById('consent-client').textContent = details.clientName;
        document.getElementById('consent-host').textContent = details.redirectHost;
        stepSignin.hidden = true;
        stepConsent.hidden = false;
        show('', '');
      } catch (error) {
        show(error.message, 'error');
      }
    }

    function decide(path, busyText) {
      return async () => {
        document.getElementById('approve').disabled = true;
        document.getElementById('deny').disabled = true;
        show(busyText, 'busy');
        try {
          const result = await post(path);
          window.location.href = result.redirect;
        } catch (error) {
          show(error.message, 'error');
          document.getElementById('approve').disabled = false;
          document.getElementById('deny').disabled = false;
        }
      };
    }

    document.getElementById('approve').addEventListener('click', decide('/approve', 'Zugriff wird erteilt …'));
    document.getElementById('deny').addEventListener('click', decide('/deny', 'Wird abgebrochen …'));
    window.onGoogleCredential = onGoogleCredential;
  </script>
  <script src="https://accounts.google.com/gsi/client" async defer nonce="${nonce}"></script>
</body>
</html>`;
}

/** Schlichte Fehlerseite, wenn die Anmeldung gar nicht erst starten kann. */
export function renderErrorPage(title: string, message: string): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Kochbuch — ${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px;
         font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width:440px; text-align:center; }
  h1 { font-size:1.3rem; margin:0 0 12px; }
  p { color:#6d635a; line-height:1.55; margin:0; }
</style>
</head>
<body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></main></body>
</html>`;
}
