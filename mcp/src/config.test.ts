import { describe, expect, test } from 'vitest';
import { loadConfig } from './config.js';

const base = {
  COOKBOOK_API_URL: 'https://api.cookbook.example',
  COOKBOOK_TOKEN: 'jwt-token',
};

const httpBase = {
  COOKBOOK_API_URL: base.COOKBOOK_API_URL,
  MCP_TRANSPORT: 'http',
  MCP_PUBLIC_URL: 'https://cookbook.example',
  GOOGLE_CLIENT_ID: '123-abc.apps.googleusercontent.com',
};

describe('loadConfig — stdio', () => {
  test('liest die Basiskonfiguration mit festem Token', () => {
    const config = loadConfig(base);

    expect(config.apiUrl).toBe('https://api.cookbook.example');
    expect(config.credentials).toEqual({ kind: 'token', token: 'jwt-token' });
    expect(config.transport).toBe('stdio');
    expect(config.timeoutMs).toBe(30_000);
    expect(config.http).toBeNull();
  });

  test('entfernt abschließende Slashes der API-URL', () => {
    expect(loadConfig({ ...base, COOKBOOK_API_URL: 'https://api.example.test//' }).apiUrl).toBe(
      'https://api.example.test',
    );
  });

  test('akzeptiert Benutzername und Passwort als Alternative zum Token', () => {
    const config = loadConfig({
      COOKBOOK_API_URL: base.COOKBOOK_API_URL,
      COOKBOOK_USERNAME: 'thorsten',
      COOKBOOK_PASSWORD: 'geheim',
    });

    expect(config.credentials).toEqual({ kind: 'password', username: 'thorsten', password: 'geheim' });
  });

  test('bevorzugt das Token, wenn beide Varianten gesetzt sind', () => {
    const config = loadConfig({ ...base, COOKBOOK_USERNAME: 'thorsten', COOKBOOK_PASSWORD: 'geheim' });

    expect(config.credentials?.kind).toBe('token');
  });

  test('verlangt irgendeine Form von Zugangsdaten', () => {
    expect(() => loadConfig({ COOKBOOK_API_URL: base.COOKBOOK_API_URL })).toThrow(/COOKBOOK_TOKEN/);
  });

  test('verlangt beide Teile der Passwort-Variante', () => {
    expect(() => loadConfig({ COOKBOOK_API_URL: base.COOKBOOK_API_URL, COOKBOOK_USERNAME: 'thorsten' })).toThrow(
      /COOKBOOK_TOKEN/,
    );
  });

  test('meldet eine fehlende API-URL', () => {
    expect(() => loadConfig({ COOKBOOK_TOKEN: 'x' })).toThrow(/COOKBOOK_API_URL/);
  });

  test('weist eine URL ohne http(s) zurück', () => {
    expect(() => loadConfig({ ...base, COOKBOOK_API_URL: 'ftp://api.example.test' })).toThrow(/http/);
  });

  test('weist eine unsinnige URL zurück', () => {
    expect(() => loadConfig({ ...base, COOKBOOK_API_URL: 'nicht-mal-eine-url' })).toThrow(/keine gültige URL/);
  });

  test('weist einen unbekannten Transport zurück', () => {
    expect(() => loadConfig({ ...base, MCP_TRANSPORT: 'grpc' })).toThrow(/MCP_TRANSPORT/);
  });
});

describe('loadConfig — http mit OAuth', () => {
  test('liest die öffentliche Adresse und die Google-Client-ID', () => {
    const config = loadConfig({ ...httpBase, MCP_HTTP_PORT: '9999', MCP_HTTP_HOST: '0.0.0.0' });

    expect(config.transport).toBe('http');
    expect(config.http).toEqual({
      host: '0.0.0.0',
      port: 9999,
      publicUrl: 'https://cookbook.example',
      googleClientId: '123-abc.apps.googleusercontent.com',
      dataDir: './.data',
      allowedRedirectOrigins: ['https://claude.ai', 'https://claude.com'],
    });
  });

  test('braucht keine Zugangsdaten — jede Person meldet sich selbst an', () => {
    const config = loadConfig(httpBase);

    expect(config.credentials).toBeNull();
  });

  test('verlangt MCP_PUBLIC_URL', () => {
    const { MCP_PUBLIC_URL: _unused, ...withoutUrl } = httpBase;

    expect(() => loadConfig(withoutUrl)).toThrow(/MCP_PUBLIC_URL/);
  });

  test('verlangt GOOGLE_CLIENT_ID', () => {
    const { GOOGLE_CLIENT_ID: _unused, ...withoutClient } = httpBase;

    expect(() => loadConfig(withoutClient)).toThrow(/GOOGLE_CLIENT_ID/);
  });

  test('verlangt https für die öffentliche Adresse', () => {
    expect(() => loadConfig({ ...httpBase, MCP_PUBLIC_URL: 'http://cookbook.example' })).toThrow(/https/);
  });

  test('erlaubt http auf localhost für lokale Tests', () => {
    const config = loadConfig({ ...httpBase, MCP_PUBLIC_URL: 'http://localhost:4003' });

    expect(config.http?.publicUrl).toBe('http://localhost:4003');
  });

  test('weist eine öffentliche Adresse mit Pfad zurück', () => {
    expect(() => loadConfig({ ...httpBase, MCP_PUBLIC_URL: 'https://cookbook.example/mcp' })).toThrow(/Pfad/);
  });

  test('weist einen ungültigen Port zurück', () => {
    expect(() => loadConfig({ ...httpBase, MCP_HTTP_PORT: '70000' })).toThrow(/MCP_HTTP_PORT/);
  });

  test('übernimmt ein abweichendes Datenverzeichnis', () => {
    expect(loadConfig({ ...httpBase, MCP_DATA_DIR: '/data' }).http?.dataDir).toBe('/data');
  });

  test('übernimmt eigene Rücksprung-Origins', () => {
    const config = loadConfig({
      ...httpBase,
      MCP_ALLOWED_REDIRECT_ORIGINS: 'https://claude.ai/, https://beispiel.test:8443/pfad',
    });

    expect(config.http?.allowedRedirectOrigins).toEqual(['https://claude.ai', 'https://beispiel.test:8443']);
  });

  test('weist eine unsinnige Rücksprung-Origin zurück', () => {
    expect(() => loadConfig({ ...httpBase, MCP_ALLOWED_REDIRECT_ORIGINS: 'keine-url' })).toThrow(
      /MCP_ALLOWED_REDIRECT_ORIGINS/,
    );
  });
});
