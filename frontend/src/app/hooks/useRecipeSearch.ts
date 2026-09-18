import { useEffect, useMemo, useState } from 'react';
import type { Recipe } from '@/app/types/recipe';
import { recipesApi } from '@/app/services/api';

const DEBOUNCE_MS = 300;

/**
 * Combines the instant client-side match (title and ingredient names) with the
 * server's full-text search (also categories, notes and instructions).
 *
 * The client-side match keeps the list responsive while typing and still works
 * when the server search fails; server hits are merged in once they arrive and
 * decide the order (best matches first).
 */
export function useRecipeSearch(recipes: Recipe[], query: string): Recipe[] {
  const [serverIds, setServerIds] = useState<{ query: string; ids: string[] } | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setServerIds(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const ids = await recipesApi.search(term);
        if (!cancelled) {
          setServerIds({ query: term, ids });
        }
      } catch (error) {
        console.error('Recipe search error:', error);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return recipes;
    }

    // Only trust server results that belong to the current query.
    const rankById = new Map<string, number>();
    if (serverIds?.query === query.trim()) {
      serverIds.ids.forEach((id, index) => rankById.set(id, index));
    }

    const matchesLocally = (recipe: Recipe) =>
      recipe.title.toLowerCase().includes(term) ||
      recipe.ingredients.some((ing) => ing.name.toLowerCase().includes(term));

    return recipes
      .filter((recipe) => rankById.has(recipe.id) || matchesLocally(recipe))
      .sort((a, b) => (rankById.get(a.id) ?? Infinity) - (rankById.get(b.id) ?? Infinity));
  }, [recipes, query, serverIds]);
}
