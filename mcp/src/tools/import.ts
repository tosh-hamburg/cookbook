import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClientResolver } from '../client-resolver.js';
import { describeImages, scrapedToCreatePayload, summarizeRecipe } from '../recipe.js';
import { assertPublicHttpUrl } from '../url-guard.js';
import { jsonResult, runTool } from './result.js';

/** Werkzeug zum Übernehmen eines Rezepts von einer Webseite. */
export function registerImportTools(server: McpServer, resolveClient: ClientResolver): void {
  server.registerTool(
    'import_recipe_from_url',
    {
      title: 'Rezept aus URL importieren',
      description:
        'Liest ein Rezept von einer Webseite aus (u. a. Chefkoch, Zeit, FAZ "Gesünder Kochen" und alle Seiten ' +
        'mit schema.org-Rezeptdaten) und legt es standardmäßig direkt an. Mit save: false wird nur eine Vorschau ' +
        'zurückgegeben; Bilder gehen dabei verloren, weil sie nicht durch die Unterhaltung geschleust werden — ' +
        'zum Speichern mit Bildern das Werkzeug erneut mit save: true aufrufen.',
      inputSchema: {
        url: z.string().url().max(2000).describe('Vollständige URL der Rezeptseite'),
        save: z.boolean().default(true).describe('true legt das Rezept an, false liefert nur eine Vorschau'),
        title: z.string().trim().min(1).max(300).optional().describe('Überschreibt den erkannten Titel'),
        categories: z
          .array(z.string().trim().min(1).max(100))
          .max(50)
          .optional()
          .describe('Überschreibt die erkannten Kategorien'),
        notes: z.string().max(20_000).optional().describe('Notiz, die am Rezept gespeichert wird'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ url, save, title, categories, notes }, extra) =>
      runTool(async () => {
        const client = resolveClient(extra);
        // Das Backend ruft diese URL serverseitig ab — deshalb hier nur
        // öffentliche http(s)-Adressen durchlassen.
        const scraped = await client.importFromUrl(assertPublicHttpUrl(url));

        if (!save) {
          const { images, ...rest } = scraped;
          return jsonResult({
            saved: false,
            hint: 'Vorschau. Zum Speichern erneut mit save: true aufrufen — nur dann werden die Bilder übernommen.',
            recipe: { ...rest, images: describeImages(images ?? []) },
          });
        }

        const payload = scrapedToCreatePayload(scraped, {
          ...(title !== undefined ? { title } : {}),
          ...(categories !== undefined ? { categories } : {}),
          ...(notes !== undefined ? { notes } : {}),
          sourceUrl: scraped.sourceUrl ?? url,
        });
        const created = await client.createRecipe(payload);
        return jsonResult({ saved: true, recipe: summarizeRecipe(created) });
      }),
  );
}
