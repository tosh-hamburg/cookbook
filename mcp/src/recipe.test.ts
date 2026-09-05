import { describe, expect, test } from 'vitest';
import {
  describeImages,
  mergeRecipe,
  resolveTotalTime,
  scrapedToCreatePayload,
  summarizeListItem,
  summarizeRecipe,
  toCreatePayload,
} from './recipe.js';
import { makeRecipe } from './test-utils.js';
import type { CreateRecipeInput, UpdateRecipeInput } from './schemas/recipe.js';

const createInput: CreateRecipeInput = {
  title: 'Pfannkuchen',
  instructions: 'Teig rühren, backen.',
  ingredients: [{ name: 'Mehl', amount: '250 g' }],
  prepTime: 10,
  restTime: 30,
  cookTime: 15,
  servings: 2,
  caloriesPerUnit: 400,
  weightUnit: 'Portion',
  categories: ['Dessert'],
  images: [],
  totalTime: undefined,
  sourceUrl: undefined,
  notes: undefined,
};

describe('resolveTotalTime', () => {
  test('summiert die Teilzeiten, wenn keine Gesamtzeit angegeben ist', () => {
    expect(resolveTotalTime({ prepTime: 10, restTime: 30, cookTime: 15 })).toBe(55);
  });

  test('übernimmt eine ausdrücklich gesetzte Gesamtzeit', () => {
    expect(resolveTotalTime({ prepTime: 10, restTime: 30, cookTime: 15 }, 40)).toBe(40);
  });

  test('akzeptiert die ausdrückliche Gesamtzeit 0', () => {
    expect(resolveTotalTime({ prepTime: 10, restTime: 0, cookTime: 5 }, 0)).toBe(0);
  });
});

describe('toCreatePayload', () => {
  test('berechnet die Gesamtzeit und setzt optionale Felder auf null', () => {
    const payload = toCreatePayload(createInput);

    expect(payload.totalTime).toBe(55);
    expect(payload.sourceUrl).toBeNull();
    expect(payload.notes).toBeNull();
    expect(payload.ingredients).toEqual([{ name: 'Mehl', amount: '250 g' }]);
  });

  test('übernimmt Quelle und Notizen, wenn angegeben', () => {
    const payload = toCreatePayload({ ...createInput, sourceUrl: 'https://example.test/rezept', notes: 'lecker' });

    expect(payload.sourceUrl).toBe('https://example.test/rezept');
    expect(payload.notes).toBe('lecker');
  });
});

describe('mergeRecipe', () => {
  const current = makeRecipe();

  test('ändert nur die angegebenen Felder', () => {
    const patch: UpdateRecipeInput = { id: current.id, title: 'Neue Linsensuppe' };

    const payload = mergeRecipe(current, patch);

    expect(payload.title).toBe('Neue Linsensuppe');
    expect(payload.instructions).toBe(current.instructions);
    expect(payload.servings).toBe(current.servings);
  });

  test('erhält Zutaten und Kategorien, wenn sie nicht Teil der Änderung sind', () => {
    // Das ist der entscheidende Fall: Das Backend löscht bei PUT alle Zutaten
    // und Kategorien, die nicht mitgesendet werden.
    const payload = mergeRecipe(current, { id: current.id, notes: 'Mit Essig abschmecken' });

    expect(payload.ingredients).toEqual(current.ingredients);
    expect(payload.categories).toEqual(current.categories);
    expect(payload.images).toEqual(current.images);
  });

  test('ersetzt die Zutatenliste vollständig, wenn sie angegeben ist', () => {
    const payload = mergeRecipe(current, { id: current.id, ingredients: [{ name: 'Bohnen', amount: '400 g' }] });

    expect(payload.ingredients).toEqual([{ name: 'Bohnen', amount: '400 g' }]);
  });

  test('berechnet die Gesamtzeit neu, wenn sich eine Teilzeit ändert', () => {
    const payload = mergeRecipe(current, { id: current.id, cookTime: 30 });

    expect(payload.cookTime).toBe(30);
    expect(payload.totalTime).toBe(15 + 0 + 30);
  });

  test('behält die Gesamtzeit, wenn sich keine Teilzeit ändert', () => {
    const payload = mergeRecipe(current, { id: current.id, title: 'Anders' });

    expect(payload.totalTime).toBe(current.totalTime);
  });

  test('lässt eine ausdrücklich gesetzte Gesamtzeit gewinnen', () => {
    const payload = mergeRecipe(current, { id: current.id, cookTime: 30, totalTime: 99 });

    expect(payload.totalTime).toBe(99);
  });

  test('löscht optionale Felder bei null', () => {
    const withNotes = makeRecipe({ notes: 'alt', sourceUrl: 'https://example.test' });

    const payload = mergeRecipe(withNotes, { id: withNotes.id, notes: null, sourceUrl: null });

    expect(payload.notes).toBeNull();
    expect(payload.sourceUrl).toBeNull();
  });

  test('behält optionale Felder, wenn sie nicht Teil der Änderung sind', () => {
    const withNotes = makeRecipe({ notes: 'alt', sourceUrl: 'https://example.test' });

    const payload = mergeRecipe(withNotes, { id: withNotes.id, title: 'Neu' });

    expect(payload.notes).toBe('alt');
    expect(payload.sourceUrl).toBe('https://example.test');
  });
});

describe('scrapedToCreatePayload', () => {
  const scraped = {
    title: 'Importiert',
    images: ['https://example.test/bild.jpg'],
    ingredients: [{ name: 'Salz', amount: '1 Prise' }],
    instructions: 'Kochen.',
    prepTime: 5,
    restTime: 0,
    cookTime: 20,
    totalTime: 0,
    servings: 3,
    caloriesPerUnit: 0,
    weightUnit: '',
    categories: [],
    sourceUrl: 'https://example.test/rezept',
  };

  test('füllt fehlende Angaben mit sinnvollen Vorgaben', () => {
    const payload = scrapedToCreatePayload(scraped);

    expect(payload.weightUnit).toBe('Portion');
    expect(payload.totalTime).toBe(0);
    expect(payload.notes).toBeNull();
    expect(payload.sourceUrl).toBe('https://example.test/rezept');
  });

  test('lässt Überschreibungen gewinnen', () => {
    const payload = scrapedToCreatePayload(scraped, { title: 'Eigener Titel', categories: ['Snack'] });

    expect(payload.title).toBe('Eigener Titel');
    expect(payload.categories).toEqual(['Snack']);
  });
});

describe('describeImages', () => {
  test('gibt http-URLs unverändert zurück', () => {
    expect(describeImages(['https://example.test/bild.jpg'])).toEqual([
      { index: 0, kind: 'url', value: 'https://example.test/bild.jpg' },
    ]);
  });

  test('ersetzt Base64-Bilder durch Typ und ungefähre Größe', () => {
    const base64 = 'AAAA'.repeat(1000); // 4000 Zeichen -> 3000 Bytes

    const [description] = describeImages([`data:image/jpeg;base64,${base64}`]);

    expect(description).toEqual({ index: 0, kind: 'base64', value: 'image/jpeg', approxBytes: 3000 });
  });

  test('gibt niemals die Bilddaten selbst zurück', () => {
    const payload = 'A'.repeat(10_000);

    const serialized = JSON.stringify(describeImages([`data:image/png;base64,${payload}`]));

    expect(serialized).not.toContain(payload);
    expect(serialized.length).toBeLessThan(200);
  });
});

describe('summarizeRecipe', () => {
  test('behält alle Felder und beschreibt nur die Bilder', () => {
    const recipe = makeRecipe({ images: ['data:image/jpeg;base64,' + 'AAAA'.repeat(500)] });

    const summary = summarizeRecipe(recipe);

    expect(summary.title).toBe(recipe.title);
    expect(summary.ingredients).toEqual(recipe.ingredients);
    expect(summary.images).toEqual([{ index: 0, kind: 'base64', value: 'image/jpeg', approxBytes: 1500 }]);
  });
});

describe('summarizeListItem', () => {
  test('ersetzt das Thumbnail durch ein Kennzeichen', () => {
    const summary = summarizeListItem({
      id: 'r-1',
      title: 'Suppe',
      thumbnail: 'data:image/jpeg;base64,AAAA',
      prepTime: 5,
      cookTime: 10,
      totalTime: 15,
      servings: 2,
      categories: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(summary).not.toHaveProperty('thumbnail');
    expect(summary.hasImage).toBe(true);
  });

  test('nutzt hasImage des Backends, wenn kein Thumbnail geliefert wurde', () => {
    const summary = summarizeListItem({
      id: 'r-3',
      title: 'Mit Bild, ohne Thumbnail',
      thumbnail: null,
      hasImage: true,
      prepTime: 0,
      cookTime: 0,
      totalTime: 0,
      servings: 1,
      categories: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(summary.hasImage).toBe(true);
  });

  test('kennzeichnet Rezepte ohne Bild', () => {
    const summary = summarizeListItem({
      id: 'r-2',
      title: 'Ohne Bild',
      thumbnail: null,
      prepTime: 0,
      cookTime: 0,
      totalTime: 0,
      servings: 1,
      categories: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(summary.hasImage).toBe(false);
  });
});
