import type { ApiRecipe, ApiRecipeListItem, ApiScrapedRecipe, RecipeWritePayload } from './api/types.js';
import type { CreateRecipeInput, UpdateRecipeInput } from './schemas/recipe.js';

/**
 * Reine Abbildungsfunktionen zwischen Werkzeug-Eingaben, API-Nutzlasten und
 * den kompakten Antworten, die das Modell zu sehen bekommt.
 *
 * Bilder sind in dieser Anwendung häufig Base64-Data-URLs mit mehreren hundert
 * Kilobyte. Sie dürfen niemals in einer Werkzeug-Antwort landen — sonst füllt
 * ein einziger Aufruf das Kontextfenster. Deshalb ersetzt
 * {@link describeImages} jedes Bild durch eine kurze Beschreibung.
 */

/** Gesamtzeit: explizit gesetzter Wert, sonst Summe der Teilzeiten. */
export function resolveTotalTime(parts: { prepTime: number; restTime: number; cookTime: number }, explicit?: number): number {
  if (typeof explicit === 'number') return explicit;
  return parts.prepTime + parts.restTime + parts.cookTime;
}

/** Baut die Nutzlast für `POST /api/recipes` aus einer Werkzeug-Eingabe. */
export function toCreatePayload(input: CreateRecipeInput): RecipeWritePayload {
  const times = { prepTime: input.prepTime, restTime: input.restTime, cookTime: input.cookTime };
  return {
    title: input.title,
    images: input.images,
    ingredients: input.ingredients,
    instructions: input.instructions,
    ...times,
    totalTime: resolveTotalTime(times, input.totalTime),
    servings: input.servings,
    caloriesPerUnit: input.caloriesPerUnit,
    weightUnit: input.weightUnit,
    categories: input.categories,
    sourceUrl: input.sourceUrl ?? null,
    notes: input.notes ?? null,
  };
}

/**
 * Führt eine Teiländerung mit dem bestehenden Rezept zusammen.
 *
 * Nötig, weil `PUT /api/recipes/:id` kein echtes PATCH ist: Das Backend löscht
 * bei jedem Aufruf alle Zutaten und Kategorien und legt nur die mitgesendeten
 * wieder an. Ohne dieses Zusammenführen würde eine Änderung des Titels die
 * Zutatenliste leeren.
 */
export function mergeRecipe(current: ApiRecipe, patch: UpdateRecipeInput): RecipeWritePayload {
  const times = {
    prepTime: patch.prepTime ?? current.prepTime,
    restTime: patch.restTime ?? current.restTime,
    cookTime: patch.cookTime ?? current.cookTime,
  };

  // Gesamtzeit neu berechnen, sobald sich eine Teilzeit ändert und der Aufrufer
  // keine eigene Gesamtzeit vorgibt.
  const timesChanged =
    patch.prepTime !== undefined || patch.restTime !== undefined || patch.cookTime !== undefined;
  const totalTime =
    patch.totalTime ?? (timesChanged ? times.prepTime + times.restTime + times.cookTime : current.totalTime);

  return {
    title: patch.title ?? current.title,
    images: patch.images ?? current.images,
    ingredients: patch.ingredients ?? current.ingredients,
    instructions: patch.instructions ?? current.instructions,
    ...times,
    totalTime,
    servings: patch.servings ?? current.servings,
    caloriesPerUnit: patch.caloriesPerUnit ?? current.caloriesPerUnit,
    weightUnit: patch.weightUnit ?? current.weightUnit,
    categories: patch.categories ?? current.categories,
    sourceUrl: patch.sourceUrl === undefined ? current.sourceUrl : patch.sourceUrl,
    notes: patch.notes === undefined ? current.notes : patch.notes,
  };
}

/** Übernimmt ein per Import gelesenes Rezept in eine Anlege-Nutzlast. */
export function scrapedToCreatePayload(scraped: ApiScrapedRecipe, overrides: Partial<RecipeWritePayload> = {}): RecipeWritePayload {
  const times = {
    prepTime: scraped.prepTime ?? 0,
    restTime: scraped.restTime ?? 0,
    cookTime: scraped.cookTime ?? 0,
  };
  return {
    title: scraped.title,
    images: scraped.images ?? [],
    ingredients: scraped.ingredients ?? [],
    instructions: scraped.instructions ?? '',
    ...times,
    totalTime: resolveTotalTime(times, scraped.totalTime),
    servings: scraped.servings ?? 4,
    caloriesPerUnit: scraped.caloriesPerUnit ?? 0,
    weightUnit: scraped.weightUnit || 'Portion',
    categories: scraped.categories ?? [],
    sourceUrl: scraped.sourceUrl ?? null,
    notes: null,
    ...overrides,
  };
}

export interface ImageDescription {
  index: number;
  kind: 'url' | 'base64';
  /** Bei URLs die URL selbst, bei Base64 der MIME-Typ. */
  value: string;
  approxBytes?: number;
}

/** Ersetzt Bilddaten durch kurze Beschreibungen, damit keine Base64-Blobs im Kontext landen. */
export function describeImages(images: readonly string[]): ImageDescription[] {
  return images.map((image, index) => {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i.exec(image);
    if (!match) {
      return { index, kind: 'url' as const, value: image.slice(0, 500) };
    }
    // 4 Base64-Zeichen kodieren 3 Bytes.
    return {
      index,
      kind: 'base64' as const,
      value: match[1],
      approxBytes: Math.floor((match[2].length * 3) / 4),
    };
  });
}

/** Kompakte Darstellung eines vollständigen Rezepts — ohne Bilddaten. */
export function summarizeRecipe(recipe: ApiRecipe) {
  const { images, ...rest } = recipe;
  return { ...rest, images: describeImages(images) };
}

/** Kompakte Darstellung eines Listeneintrags — ohne Thumbnail-Daten. */
export function summarizeListItem(item: ApiRecipeListItem) {
  const { thumbnail, hasImage, ...rest } = item;
  // Neuere Backend-Stände liefern hasImage direkt; ältere nur das Thumbnail.
  return { ...rest, hasImage: hasImage ?? Boolean(thumbnail) };
}
