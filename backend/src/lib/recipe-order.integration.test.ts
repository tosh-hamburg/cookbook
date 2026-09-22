// Läuft nur gegen eine echte, migrierte PostgreSQL-Datenbank:
//   TEST_DATABASE_URL=postgresql://... npx vitest run
// Prüft, dass RECIPE_LIST_ORDER die Paginierung stabil hält, wenn mehrere
// Rezepte denselben createdAt-Wert tragen.
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { RECIPE_LIST_ORDER } from './recipe-order';

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)('RECIPE_LIST_ORDER (PostgreSQL)', () => {
  // Erst im beforeAll erzeugen — der describe-Rumpf läuft auch bei skipIf.
  let prisma: PrismaClient;
  const marker = `ord${Date.now().toString(36)}`;
  const RECIPE_COUNT = 7;
  const PAGE_SIZE = 2;
  const recipeBase = {
    prepTime: 10,
    restTime: 0,
    cookTime: 20,
    totalTime: 30,
    caloriesPerUnit: 100,
    weightUnit: 'g',
    instructions: 'Alles in einen Topf geben.',
  };
  let userId: string;
  let createdIds: string[];

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const user = await prisma.user.create({ data: { username: marker } });
    userId = user.id;

    // Eine gemeinsame Transaktion: CURRENT_TIMESTAMP ist deren Startzeit, alle
    // Rezepte bekommen denselben createdAt-Wert — genau der Fall, in dem eine
    // Sortierung allein nach createdAt nicht eindeutig ist.
    const created = await prisma.$transaction(
      Array.from({ length: RECIPE_COUNT }, (_, index) =>
        prisma.recipe.create({
          data: { ...recipeBase, userId, title: `${marker} Rezept ${index}` },
          select: { id: true },
        })
      )
    );
    createdIds = created.map((recipe) => recipe.id);
  });

  afterAll(async () => {
    await prisma.recipe.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test('alle Rezepte teilen sich einen createdAt-Wert', async () => {
    const rows = await prisma.recipe.findMany({
      where: { userId },
      select: { createdAt: true },
    });
    const distinct = new Set(rows.map((row) => row.createdAt.getTime()));
    expect(distinct.size).toBe(1);
  });

  test('Paginierung liefert jedes Rezept genau einmal', async () => {
    const seen: string[] = [];
    for (let offset = 0; offset < RECIPE_COUNT; offset += PAGE_SIZE) {
      const page = await prisma.recipe.findMany({
        where: { userId },
        select: { id: true },
        orderBy: RECIPE_LIST_ORDER,
        skip: offset,
        take: PAGE_SIZE,
      });
      seen.push(...page.map((recipe) => recipe.id));
    }

    expect(new Set(seen).size).toBe(seen.length);
    expect([...seen].sort()).toEqual([...createdIds].sort());
  });

  test('dieselbe Seite zweimal abgefragt ist identisch', async () => {
    const query = {
      where: { userId },
      select: { id: true },
      orderBy: RECIPE_LIST_ORDER,
      skip: PAGE_SIZE,
      take: PAGE_SIZE,
    };
    const first = await prisma.recipe.findMany(query);
    const second = await prisma.recipe.findMany(query);
    expect(first).toEqual(second);
  });
});
