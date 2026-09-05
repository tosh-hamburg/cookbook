import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClientResolver } from '../client-resolver.js';
import { jsonResult, runTool, textResult } from './result.js';

/** Werkzeuge für Kategorien und Sammlungen — der Katalog, in den Rezepte einsortiert werden. */
export function registerCatalogTools(server: McpServer, resolveClient: ClientResolver): void {
  server.registerTool(
    'list_categories',
    {
      title: 'Kategorien auflisten',
      description:
        'Listet alle vorhandenen Kategorien. Beim Anlegen oder Ändern eines Rezepts können auch neue ' +
        'Kategorienamen verwendet werden — sie werden dann automatisch angelegt. Diese Liste hilft, ' +
        'Dubletten durch abweichende Schreibweisen zu vermeiden.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (_args, extra) => runTool(async () => jsonResult(await resolveClient(extra).listCategories())),
  );

  server.registerTool(
    'list_collections',
    {
      title: 'Sammlungen auflisten',
      description: 'Listet alle Sammlungen (Kochbücher) mit ID, Name und Beschreibung.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (_args, extra) => runTool(async () => jsonResult(await resolveClient(extra).listCollections())),
  );

  server.registerTool(
    'add_recipe_to_collection',
    {
      title: 'Rezept zu Sammlung hinzufügen',
      description: 'Ordnet ein Rezept einer Sammlung zu. Erfordert Admin-Rechte.',
      inputSchema: {
        collectionId: z.string().trim().min(1).describe('ID der Sammlung (siehe list_collections)'),
        recipeId: z.string().trim().min(1).describe('ID des Rezepts'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ collectionId, recipeId }, extra) =>
      runTool(async () => {
        await resolveClient(extra).addRecipeToCollection(collectionId, recipeId);
        return textResult(`Rezept ${recipeId} wurde der Sammlung ${collectionId} hinzugefügt.`);
      }),
  );

  server.registerTool(
    'remove_recipe_from_collection',
    {
      title: 'Rezept aus Sammlung entfernen',
      description:
        'Entfernt die Zuordnung eines Rezepts zu einer Sammlung. Das Rezept selbst bleibt erhalten. ' +
        'Erfordert Admin-Rechte.',
      inputSchema: {
        collectionId: z.string().trim().min(1).describe('ID der Sammlung'),
        recipeId: z.string().trim().min(1).describe('ID des Rezepts'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ collectionId, recipeId }, extra) =>
      runTool(async () => {
        await resolveClient(extra).removeRecipeFromCollection(collectionId, recipeId);
        return textResult(`Rezept ${recipeId} wurde aus der Sammlung ${collectionId} entfernt.`);
      }),
  );
}
