import { describe, expect, test } from 'vitest';
import { ApiConnectionError, ApiError, TwoFactorRequiredError } from './errors.js';
import { describeError } from './tools/result.js';

describe('ApiError.toUserMessage', () => {
  test.each([
    [401, /Nicht authentifiziert/],
    [403, /Keine Berechtigung/],
    [404, /Nicht gefunden/],
    [429, /Zu viele Anfragen/],
    [500, /HTTP 500/],
  ])('deutet HTTP %i verständlich', (status, expected) => {
    expect(new ApiError(status, '/api/recipes', 'Meldung').toUserMessage()).toMatch(expected);
  });

  test('nennt Pfad und Originalmeldung', () => {
    const message = new ApiError(404, '/api/recipes/x', 'Rezept nicht gefunden').toUserMessage();

    expect(message).toContain('/api/recipes/x');
    expect(message).toContain('Rezept nicht gefunden');
  });
});

describe('ApiConnectionError', () => {
  test('nennt URL und Ursache', () => {
    const error = new ApiConnectionError('https://api.example.test/api/recipes', new Error('ECONNREFUSED'));

    expect(error.message).toContain('https://api.example.test/api/recipes');
    expect(error.message).toContain('ECONNREFUSED');
  });

  test('verkraftet eine Ursache, die kein Error ist', () => {
    expect(new ApiConnectionError('https://x.test', 'kaputt').message).toContain('kaputt');
  });
});

describe('describeError', () => {
  test('nutzt die gedeutete Meldung eines ApiError', () => {
    expect(describeError(new ApiError(403, '/api/recipes/1', 'Keine Berechtigung zum Bearbeiten'))).toMatch(
      /Keine Berechtigung/,
    );
  });

  test('reicht Verbindungsfehler durch', () => {
    expect(describeError(new ApiConnectionError('https://x.test', new Error('timeout')))).toMatch(/nicht erreichbar/);
  });

  test('erklärt die 2FA-Sperre', () => {
    expect(describeError(new TwoFactorRequiredError())).toMatch(/COOKBOOK_TOKEN/);
  });

  test('nennt Name und Meldung eines gewöhnlichen Fehlers', () => {
    expect(describeError(new TypeError('kaputt'))).toBe('TypeError: kaputt');
  });

  test('verkraftet geworfene Werte, die kein Error sind', () => {
    expect(describeError('nur ein String')).toBe('Unbekannter Fehler: nur ein String');
  });
});
