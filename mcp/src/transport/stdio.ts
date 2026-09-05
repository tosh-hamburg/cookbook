import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ClientResolver } from '../client-resolver.js';
import { createMcpServer } from '../server.js';

/**
 * Startet den Server über stdio — die Betriebsart für lokal von Claude
 * gestartete MCP-Server. Hier ist die Identität fest konfiguriert; die
 * Google-Anmeldung gibt es nur beim HTTP-Transport.
 *
 * Wichtig: Auf stdout darf ausschließlich das JSON-RPC-Protokoll laufen.
 * Diagnoseausgaben deshalb immer über stderr.
 */
export async function startStdioServer(resolveClient: ClientResolver): Promise<void> {
  const server = createMcpServer(resolveClient);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('cookbook-mcp läuft über stdio');
}
