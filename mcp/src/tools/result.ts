import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ApiConnectionError, ApiError, TwoFactorRequiredError } from '../errors.js';
import { BlockedUrlError } from '../url-guard.js';

/** Erfolgreiches Werkzeug-Ergebnis mit JSON-Nutzlast als Text. */
export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

/** Kurzes Erfolgs-Ergebnis ohne strukturierte Daten. */
export function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}

/** Fehler-Ergebnis. MCP-Werkzeuge melden Fachfehler im Ergebnis, nicht als Protokollfehler. */
export function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/**
 * Führt einen Werkzeug-Rumpf aus und übersetzt alle Fehler in eine
 * verständliche Meldung, statt die Verbindung mit einem Protokollfehler zu
 * beenden.
 */
export async function runTool(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (error) {
    return errorResult(describeError(error));
  }
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.toUserMessage();
  if (error instanceof ApiConnectionError) return error.message;
  if (error instanceof TwoFactorRequiredError) return error.message;
  if (error instanceof BlockedUrlError) return error.message;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return `Unbekannter Fehler: ${String(error)}`;
}
