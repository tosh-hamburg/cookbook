import { PrismaClient } from '@prisma/client';

/**
 * Nutzerbezogene Rezeptstatistik: Kochzähler (aus CookEvent) und Herz
 * (RecipeFavorite). Wird jeder Rezeptantwort beigemischt, damit Web-App,
 * Android-App und MCP-Server dieselben Werte sehen.
 */
export interface RecipeStats {
  cookCount: number;
  lastCookedAt: string | null;
  isFavorite: boolean;
}

export const EMPTY_STATS: RecipeStats = { cookCount: 0, lastCookedAt: null, isFavorite: false };

export interface CookAggregate {
  recipeId: string;
  count: number;
  lastCookedAt: Date | null;
}

/** Reine Zusammenführung von Aggregaten und Favoriten (ohne Datenbank, testbar). */
export function mergeRecipeStats(
  cookAggregates: CookAggregate[],
  favoriteRecipeIds: Iterable<string>
): Map<string, RecipeStats> {
  const stats = new Map<string, RecipeStats>();

  for (const aggregate of cookAggregates) {
    stats.set(aggregate.recipeId, {
      cookCount: aggregate.count,
      lastCookedAt: aggregate.lastCookedAt ? aggregate.lastCookedAt.toISOString() : null,
      isFavorite: false
    });
  }

  for (const recipeId of favoriteRecipeIds) {
    const existing = stats.get(recipeId) ?? EMPTY_STATS;
    stats.set(recipeId, { ...existing, isFavorite: true });
  }

  return stats;
}

/** Lädt die Statistik eines Nutzers für die angegebenen Rezepte (zwei Abfragen, unabhängig von der Rezeptzahl). */
export async function loadRecipeStats(
  prisma: PrismaClient,
  userId: string,
  recipeIds: string[]
): Promise<Map<string, RecipeStats>> {
  if (recipeIds.length === 0) {
    return new Map();
  }

  const [cookGroups, favorites] = await Promise.all([
    prisma.cookEvent.groupBy({
      by: ['recipeId'],
      where: { userId, recipeId: { in: recipeIds } },
      _count: { _all: true },
      _max: { cookedAt: true }
    }),
    prisma.recipeFavorite.findMany({
      where: { userId, recipeId: { in: recipeIds } },
      select: { recipeId: true }
    })
  ]);

  return mergeRecipeStats(
    cookGroups.map(group => ({
      recipeId: group.recipeId,
      count: group._count._all,
      lastCookedAt: group._max.cookedAt
    })),
    favorites.map(favorite => favorite.recipeId)
  );
}

export function statsFor(stats: Map<string, RecipeStats>, recipeId: string): RecipeStats {
  return stats.get(recipeId) ?? EMPTY_STATS;
}
