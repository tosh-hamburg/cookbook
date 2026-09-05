import { z } from 'zod';

/**
 * Zod-Schemata für die Rezept-Werkzeuge.
 *
 * Die exportierten `*Shape`-Objekte sind rohe Zod-Shapes — genau das Format,
 * das `McpServer.registerTool({ inputSchema })` erwartet.
 */

/**
 * Obergrenzen für eingebettete Bilder.
 *
 * Der HTTP-Transport begrenzt den Anfragerumpf auf 4 MB. Ohne eigene Grenze
 * würde derselbe Aufruf über stdio funktionieren und über HTTP mit einem
 * nichtssagenden 413 scheitern. Die Schema-Grenze liegt deshalb bewusst
 * darunter und meldet den Grund verständlich.
 */
const MAX_IMAGE_CHARS = 2_000_000; // ~1,5 MB je Bild
const MAX_IMAGES_CHARS_TOTAL = 3_000_000; // ~2,2 MB für alle Bilder zusammen

/** Bilder dürfen nur öffentliche http(s)-URLs oder Base64-Data-URLs sein. */
export const imageSchema = z
  .string()
  .max(MAX_IMAGE_CHARS, `Bild ist zu groß (max. ${MAX_IMAGE_CHARS} Zeichen). Besser als http(s)-URL übergeben.`)
  .refine(
    (value) => /^https?:\/\/\S+$/i.test(value) || /^data:image\/[a-z0-9.+-]+;base64,/i.test(value),
    { message: 'Bild muss eine http(s)-URL oder eine data:image/...;base64-URL sein' },
  );

export const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(200).describe('Name der Zutat, z. B. "Mehl (Type 405)"'),
  amount: z
    .string()
    .trim()
    .max(100)
    .describe('Menge als Freitext, z. B. "250 g", "2 EL", "nach Geschmack". Leerstring erlaubt.'),
});

const minutes = z.number().int().min(0).max(100_000);

/** Felder, die Anlegen und Ändern gemeinsam haben (hier durchweg optional). */
const commonFields = {
  title: z.string().trim().min(1).max(300).describe('Titel des Rezepts'),
  instructions: z.string().trim().min(1).describe('Zubereitung als Fließtext; Schritte durch Zeilenumbrüche trennen'),
  ingredients: z.array(ingredientSchema).max(200).describe('Vollständige Zutatenliste'),
  prepTime: minutes.describe('Vorbereitungszeit in Minuten'),
  restTime: minutes.describe('Ruhe-/Wartezeit in Minuten (Teig gehen lassen, marinieren …)'),
  cookTime: minutes.describe('Koch-/Backzeit in Minuten'),
  totalTime: minutes.describe('Gesamtzeit in Minuten. Wenn nicht gesetzt, wird prep + rest + cook verwendet.'),
  servings: z.number().int().min(1).max(100).describe('Anzahl Portionen'),
  caloriesPerUnit: z.number().int().min(0).max(100_000).describe('Kalorien je Einheit (kcal)'),
  weightUnit: z.string().trim().max(50).describe('Einheit, auf die sich die Kalorien beziehen, z. B. "Portion", "100 g"'),
  categories: z
    .array(z.string().trim().min(1).max(100))
    .max(50)
    .describe('Kategorienamen; unbekannte Kategorien werden automatisch angelegt'),
  images: z
    .array(imageSchema)
    .max(10)
    .refine((list) => list.reduce((sum, image) => sum + image.length, 0) <= MAX_IMAGES_CHARS_TOTAL, {
      message: `Bilder sind zusammen zu groß (max. ${MAX_IMAGES_CHARS_TOTAL} Zeichen). Besser als http(s)-URLs übergeben.`,
    })
    .describe('Bilder als http(s)-URL oder data:image/...;base64-URL'),
  sourceUrl: z.string().url().max(2000).describe('URL der Originalquelle'),
  notes: z.string().max(20_000).describe('Freie Notizen zum Rezept'),
} as const;

/** Eingabe für `create_recipe`: Titel und Zubereitung sind Pflicht. */
export const createRecipeShape = {
  title: commonFields.title,
  instructions: commonFields.instructions,
  ingredients: commonFields.ingredients.default([]),
  prepTime: commonFields.prepTime.default(0),
  restTime: commonFields.restTime.default(0),
  cookTime: commonFields.cookTime.default(0),
  totalTime: commonFields.totalTime.optional(),
  servings: commonFields.servings.default(4),
  caloriesPerUnit: commonFields.caloriesPerUnit.default(0),
  weightUnit: commonFields.weightUnit.default('Portion'),
  categories: commonFields.categories.default([]),
  images: commonFields.images.default([]),
  sourceUrl: commonFields.sourceUrl.optional(),
  notes: commonFields.notes.optional(),
} as const;

/**
 * Eingabe für `update_recipe`: alles optional, nur die angegebenen Felder
 * werden geändert. `null` löscht ein optionales Feld.
 */
export const updateRecipeShape = {
  id: z.string().trim().min(1).describe('ID des zu ändernden Rezepts'),
  title: commonFields.title.optional(),
  instructions: commonFields.instructions.optional(),
  ingredients: commonFields.ingredients
    .describe('Ersetzt die komplette Zutatenliste. Weglassen, um sie unverändert zu lassen.')
    .optional(),
  prepTime: commonFields.prepTime.optional(),
  restTime: commonFields.restTime.optional(),
  cookTime: commonFields.cookTime.optional(),
  totalTime: commonFields.totalTime
    .describe('Gesamtzeit in Minuten. Weglassen behält den bisherigen Wert; bei geänderten Teilzeiten neu berechnet.')
    .optional(),
  servings: commonFields.servings.optional(),
  caloriesPerUnit: commonFields.caloriesPerUnit.optional(),
  weightUnit: commonFields.weightUnit.optional(),
  categories: commonFields.categories.describe('Ersetzt die komplette Kategorienliste.').optional(),
  images: commonFields.images.describe('Ersetzt die komplette Bilderliste.').optional(),
  sourceUrl: commonFields.sourceUrl.nullable().optional(),
  notes: commonFields.notes.nullable().optional(),
} as const;

export type CreateRecipeInput = z.infer<z.ZodObject<typeof createRecipeShape>>;
export type UpdateRecipeInput = z.infer<z.ZodObject<typeof updateRecipeShape>>;
