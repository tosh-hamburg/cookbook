import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClientResolver } from '../client-resolver.js';
import { createRecipeShape, updateRecipeShape } from '../schemas/recipe.js';
import { mergeRecipe, summarizeListItem, summarizeRecipe, toCreatePayload } from '../recipe.js';
import { jsonResult, runTool, textResult } from './result.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Registriert alle Werkzeuge rund um Rezepte. */
export function registerRecipeTools(server: McpServer, resolveClient: ClientResolver): void {
  server.registerTool(
    'list_recipes',
    {
      title: 'Rezepte auflisten',
      description:
        'Listet Rezepte des Kochbuchs, optional gefiltert nach Suchbegriff im Titel, Kategorie oder Sammlung. ' +
        'Liefert eine kompakte Übersicht ohne Bilddaten. Für die vollständigen Angaben eines Rezepts ' +
        'anschließend get_recipe mit der zurückgegebenen id aufrufen.',
      inputSchema: {
        search: z.string().trim().min(1).max(200).optional().describe('Suchbegriff, wird im Titel gesucht'),
        category: z.string().trim().min(1).optional().describe('Exakter Kategoriename, z. B. "Hauptgericht"'),
        collectionIds: z
          .array(z.string().trim().min(1))
          .max(20)
          .optional()
          .describe('IDs von Sammlungen; ein Rezept passt, wenn es in mindestens einer davon liegt'),
        limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE).describe('Anzahl Treffer pro Seite'),
        offset: z.number().int().min(0).default(0).describe('Anzahl zu überspringender Treffer'),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ search, category, collectionIds, limit, offset }, extra) =>
      runTool(async () => {
        const response = await resolveClient(extra).listRecipes({
          search,
          category,
          collections: collectionIds?.join(','),
          limit,
          offset,
        });
        return jsonResult({
          total: response.total,
          offset: response.offset ?? offset,
          limit: response.limit ?? limit,
          hasMore: response.hasMore,
          items: response.items.map(summarizeListItem),
        });
      }),
  );

  server.registerTool(
    'get_recipe',
    {
      title: 'Rezept abrufen',
      description:
        'Liefert ein einzelnes Rezept mit allen Angaben: Zutaten, Zubereitung, Zeiten, Kategorien und Sammlungen. ' +
        'Bilder werden nur beschrieben (Typ und ungefähre Größe), nicht als Daten zurückgegeben.',
      inputSchema: { id: z.string().trim().min(1).describe('ID des Rezepts') },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id }, extra) => runTool(async () => jsonResult(summarizeRecipe(await resolveClient(extra).getRecipe(id)))),
  );

  server.registerTool(
    'create_recipe',
    {
      title: 'Rezept anlegen',
      description:
        'Legt ein neues Rezept an. Pflichtangaben sind Titel und Zubereitung; alles andere ist optional. ' +
        'Unbekannte Kategorien werden automatisch angelegt. Wird totalTime weggelassen, ergibt sie sich aus ' +
        'prepTime + restTime + cookTime.',
      inputSchema: createRecipeShape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (input, extra) =>
      runTool(async () => {
        const created = await resolveClient(extra).createRecipe(toCreatePayload(input));
        return jsonResult({ created: true, recipe: summarizeRecipe(created) });
      }),
  );

  server.registerTool(
    'update_recipe',
    {
      title: 'Rezept ändern',
      description:
        'Ändert ein bestehendes Rezept. Es werden nur die angegebenen Felder geändert, alle übrigen bleiben ' +
        'erhalten. Achtung: ingredients, categories und images ersetzen jeweils die komplette Liste — zum ' +
        'Ergänzen einer Zutat zuerst get_recipe aufrufen und die vollständige neue Liste senden. ' +
        'Nur der Eigentümer eines Rezepts oder ein Admin darf ändern.',
      inputSchema: updateRecipeShape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (input, extra) =>
      runTool(async () => {
        const client = resolveClient(extra);
        // Read-modify-write: PUT ersetzt serverseitig immer den kompletten
        // Datensatz, deshalb den aktuellen Stand holen und darauf aufsetzen.
        // Die API kennt weder updatedAt noch ETag, eine Kollisionsprüfung ist
        // daher nicht möglich: Wird dasselbe Rezept zeitgleich in der Web-App
        // gespeichert, gewinnt der spätere Schreibvorgang.
        const current = await client.getRecipe(input.id);
        const updated = await client.replaceRecipe(input.id, mergeRecipe(current, input));
        return jsonResult({ updated: true, recipe: summarizeRecipe(updated) });
      }),
  );

  server.registerTool(
    'delete_recipe',
    {
      title: 'Rezept löschen',
      description:
        'Löscht ein Rezept endgültig. Erfordert confirm: true, um versehentliches Löschen zu verhindern. ' +
        'Nur der Eigentümer oder ein Admin darf löschen.',
      inputSchema: {
        id: z.string().trim().min(1).describe('ID des zu löschenden Rezepts'),
        confirm: z
          .literal(true)
          .describe('Muss true sein. Vorher beim Nutzer rückfragen — das Löschen kann nicht rückgängig gemacht werden.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ id }, extra) =>
      runTool(async () => {
        const client = resolveClient(extra);
        // Titel vorher lesen, damit die Bestätigung nachvollziehbar ist.
        const recipe = await client.getRecipe(id);
        await client.deleteRecipe(id);
        return textResult(`Rezept "${recipe.title}" (${id}) wurde gelöscht.`);
      }),
  );
}
