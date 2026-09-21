import type { Recipe } from '@/app/types/recipe';

const SUBTITLE_MAX_LENGTH = 70;

/** Kurze Sachinfo unter dem Kartentitel: erste Notizzeile, sonst Kategorien. */
export function recipeSubtitle(recipe: Recipe): string {
  const firstNoteLine = (recipe.notes ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (firstNoteLine) {
    return firstNoteLine.length > SUBTITLE_MAX_LENGTH
      ? `${firstNoteLine.slice(0, SUBTITLE_MAX_LENGTH - 1).trimEnd()}…`
      : firstNoteLine;
  }
  if (recipe.categories.length > 0) {
    return recipe.categories.slice(0, 3).join(' · ');
  }
  return `${recipe.ingredients.length} Zutaten`;
}

export function primaryCollection(recipe: Recipe): string | null {
  return recipe.collections?.[0]?.name ?? null;
}

/**
 * „Rezept der Woche": höchste Kochhäufigkeit, Tie-Break zuletzt gekocht,
 * dann neuestes Rezept. Zähler und Zeitpunkt liefert das Backend pro Nutzer.
 */
export function pickFeaturedRecipe(recipes: Recipe[]): Recipe | null {
  if (recipes.length === 0) return null;

  const score = (recipe: Recipe) => ({
    count: recipe.cookCount ?? 0,
    last: recipe.lastCookedAt ? Date.parse(recipe.lastCookedAt) : 0,
    created: Date.parse(recipe.createdAt) || 0,
  });

  return recipes.reduce((best, candidate) => {
    const a = score(best);
    const b = score(candidate);
    if (b.count !== a.count) return b.count > a.count ? candidate : best;
    if (b.last !== a.last) return b.last > a.last ? candidate : best;
    return b.created > a.created ? candidate : best;
  });
}

/** Rezepte nach Kochhäufigkeit (dann zuletzt gekocht, dann neueste) sortiert. */
export function sortByCookFrequency(recipes: Recipe[]): Recipe[] {
  return [...recipes].sort((a, b) => {
    const countDiff = (b.cookCount ?? 0) - (a.cookCount ?? 0);
    if (countDiff !== 0) return countDiff;
    const lastDiff = (b.lastCookedAt ? Date.parse(b.lastCookedAt) : 0) - (a.lastCookedAt ? Date.parse(a.lastCookedAt) : 0);
    if (lastDiff !== 0) return lastDiff;
    return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
  });
}

export function sourceHost(sourceUrl: string | undefined): string | null {
  if (!sourceUrl) return null;
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    return sourceUrl;
  }
}
