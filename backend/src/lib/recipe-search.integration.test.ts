// Läuft nur gegen eine echte, migrierte PostgreSQL-Datenbank:
//   TEST_DATABASE_URL=postgresql://... npx vitest run
// Prüft die Trigger aus der Migration add_recipe_fulltext_search und die
// Abfrage in findRecipeIdsByFullText zusammen.
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { findRecipeIdsByFullText } from './recipe-search';

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)('findRecipeIdsByFullText (PostgreSQL)', () => {
  // Erst im beforeAll erzeugen — der describe-Rumpf läuft auch bei skipIf.
  let prisma: PrismaClient;
  // Nur Buchstaben und Ziffern, damit der Textparser die Markierung als ein Wort liest.
  const marker = `fts${Date.now().toString(36)}`;
  const recipeBase = {
    prepTime: 10,
    restTime: 0,
    cookTime: 20,
    totalTime: 30,
    caloriesPerUnit: 100,
    weightUnit: 'g',
  };
  let userId: string;
  let soupId: string;
  let saladId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const user = await prisma.user.create({ data: { username: marker } });
    userId = user.id;

    const soup = await prisma.recipe.create({
      data: {
        ...recipeBase,
        userId,
        title: `${marker} Tomatensuppe`,
        instructions: 'Zwiebeln anschwitzen, Tomaten dazugeben und pürieren.',
        notes: 'Schmeckt mit einem Schuss Sahne besonders cremig.',
        ingredients: { create: [{ name: 'Tomaten', amount: '500 g' }, { name: 'Zwiebel', amount: '1' }] },
        categories: { create: [{ category: { create: { name: `${marker} Vorspeise` } } }] },
      },
    });
    soupId = soup.id;

    const salad = await prisma.recipe.create({
      data: {
        ...recipeBase,
        userId,
        title: `${marker} Gurkensalat`,
        instructions: 'Gurken hobeln und mit Dressing vermengen.',
        ingredients: { create: [{ name: 'Salatgurke', amount: '1' }, { name: 'Dill', amount: '1 Bund' }] },
      },
    });
    saladId = salad.id;
  });

  afterAll(async () => {
    await prisma.recipe.deleteMany({ where: { userId } });
    await prisma.category.deleteMany({ where: { name: { startsWith: marker } } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  // Mit Markierung: nur die Testrezepte, auch bei fremden Daten in der DB.
  const search = (term: string) => findRecipeIdsByFullText(prisma, `${marker} ${term}`);
  // Ohne Markierung (für Teilstring-Fälle), auf die Testrezepte eingeschränkt.
  const searchRaw = async (term: string) =>
    (await findRecipeIdsByFullText(prisma, term)).filter((id) => id === soupId || id === saladId);

  test('findet über den Titel, auch als Präfix', async () => {
    expect(await search('Tomatensup')).toEqual([soupId]);
  });

  test('findet über die Anleitung', async () => {
    expect(await search('pürieren')).toEqual([soupId]);
  });

  test('findet über die Notizen', async () => {
    expect(await search('Sahne')).toEqual([soupId]);
  });

  test('findet über Zutaten und reduziert auf die Stammform', async () => {
    expect(await search('Salatgurken')).toEqual([saladId]);
  });

  test('findet über die Kategorie', async () => {
    expect(await search('Vorspeise')).toEqual([soupId]);
  });

  test('findet Wortteile in zusammengesetzten Titeln (Teilstring)', async () => {
    // 'suppe' ist kein Wortanfang von 'tomatensupp' — nur der Teilstring greift
    expect(await searchRaw('suppe')).toEqual([soupId]);
  });

  test('findet Wortteile in Zutatennamen (Teilstring)', async () => {
    expect(await searchRaw('tgurke')).toEqual([saladId]);
  });

  test('Teilstringsuche kennt keine Platzhalter', async () => {
    expect(await searchRaw('nsuppe')).toEqual([soupId]);
    expect(await searchRaw('nsupp_')).toEqual([]);
    expect(await searchRaw('nsupp%')).toEqual([]);
  });

  test('alle Wörter müssen vorkommen', async () => {
    expect(await search('Tomaten Dill')).toEqual([]);
  });

  test('Titeltreffer stehen vor Anleitungstreffern', async () => {
    await prisma.recipe.update({
      where: { id: saladId },
      data: { instructions: 'Gurken hobeln; passt gut zu Tomatensuppe.' },
    });
    expect(await search('Tomatensuppe')).toEqual([soupId, saladId]);
  });

  test('Zutatenänderungen aktualisieren den Suchvektor', async () => {
    await prisma.ingredient.create({ data: { recipeId: saladId, name: 'Feta', amount: '100 g' } });
    expect(await search('Feta')).toEqual([saladId]);

    await prisma.ingredient.deleteMany({ where: { recipeId: saladId, name: 'Feta' } });
    expect(await search('Feta')).toEqual([]);
  });

  test('Umbenennen einer Kategorie aktualisiert den Suchvektor', async () => {
    await prisma.category.update({
      where: { name: `${marker} Vorspeise` },
      data: { name: `${marker} Eintopf` },
    });
    expect(await search('Eintopf')).toEqual([soupId]);
    expect(await search('Vorspeise')).toEqual([]);
  });

  test('Eingaben ohne Suchwort liefern nichts', async () => {
    expect(await findRecipeIdsByFullText(prisma, '&& ::')).toEqual([]);
  });
});
