#!/usr/bin/env node
import { CookbookApiClient } from './api/client.js';
import { staticClientResolver } from './client-resolver.js';
import { loadConfig } from './config.js';
import { OAuthStore } from './oauth/store.js';
import { startHttpServer } from './transport/http.js';
import { startStdioServer } from './transport/stdio.js';

/**
 * Einstiegspunkt des Kochbuch-MCP-Servers.
 *
 * Transport über MCP_TRANSPORT:
 * • "stdio" (Standard) — Claude startet den Server lokal, die Identität kommt
 *   aus der Konfiguration.
 * • "http" — Streamable HTTP auf der Synology, Anmeldung über OAuth mit dem
 *   Google-Konto jeder Person.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const endpoint = { apiUrl: config.apiUrl, timeoutMs: config.timeoutMs };

  if (config.transport === 'http' && config.http) {
    const store = new OAuthStore(config.http.dataDir);
    await store.load();

    const server = await startHttpServer({ config: config.http, endpoint, store });
    registerShutdown(() => {
      server.close();
    });
    return;
  }

  const client = new CookbookApiClient({ ...endpoint, credentials: config.credentials! });
  await startStdioServer(staticClientResolver(client));
}

function registerShutdown(close: () => void): void {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      console.error(`\n${signal} empfangen — cookbook-mcp wird beendet`);
      close();
      process.exit(0);
    });
  }
}

main().catch((error: unknown) => {
  // stderr, damit bei stdio das Protokoll auf stdout unberührt bleibt.
  console.error('cookbook-mcp konnte nicht starten:', error instanceof Error ? error.message : error);
  process.exit(1);
});
