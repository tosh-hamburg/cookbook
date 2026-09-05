import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClientResolver } from './client-resolver.js';
import { registerCatalogTools } from './tools/catalog.js';
import { registerImportTools } from './tools/import.js';
import { registerRecipeTools } from './tools/recipes.js';

export const SERVER_NAME = 'cookbook';
export const SERVER_VERSION = '1.0.0';

const INSTRUCTIONS = [
  'Dieser Server greift auf das persönliche Kochbuch zu (Rezepte, Kategorien, Sammlungen).',
  '',
  'Arbeitsweise:',
  '• Vor dem Ändern eines Rezepts immer get_recipe aufrufen — ingredients, categories und images werden',
  '  bei update_recipe komplett ersetzt, nicht ergänzt.',
  '• Vor dem Anlegen list_categories aufrufen, um vorhandene Schreibweisen zu übernehmen.',
  '• Zeiten sind Minuten, amount ist Freitext ("250 g", "2 EL").',
  '• Bilddaten werden nie zurückgegeben, nur beschrieben. Neue Bilder als http(s)-URL übergeben.',
  '• delete_recipe löscht endgültig — vorher beim Nutzer rückfragen.',
].join('\n');

/** Baut eine MCP-Server-Instanz mit allen Kochbuch-Werkzeugen. */
export function createMcpServer(resolveClient: ClientResolver): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  );

  registerRecipeTools(server, resolveClient);
  registerCatalogTools(server, resolveClient);
  registerImportTools(server, resolveClient);

  return server;
}
