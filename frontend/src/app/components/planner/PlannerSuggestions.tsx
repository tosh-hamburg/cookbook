import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Recipe } from '@/app/types/recipe';
import { useRecipeSearch } from '@/app/hooks/useRecipeSearch';
import { collectionColor } from '@/app/utils/collectionColors';
import { primaryCollection, sortByCookFrequency } from '@/app/utils/recipeMeta';
import { setDragData } from '@/app/components/planner/dragData';
import { useTranslation } from '@/app/i18n';

interface PlannerSuggestionsProps {
  recipes: Recipe[];
  plannedRecipeIds: Set<string>;
  onPick: (recipe: Recipe) => void;
  shoppingListCount: number;
  plannedMealsCount: number;
  onOpenShoppingList: () => void;
}

const SUGGESTION_COUNT = 6;
const SEARCH_RESULT_COUNT = 12;

/** Rechte Spalte des Wochenplaners: Vorschläge (+ Suche) und Einkaufszettel-Karte. */
export function PlannerSuggestions({
  recipes,
  plannedRecipeIds,
  onPick,
  shoppingListCount,
  plannedMealsCount,
  onOpenShoppingList,
}: PlannerSuggestionsProps) {
  const { t } = useTranslation();
  const p = t.kitchen.plan;
  const [query, setQuery] = useState('');
  const searched = useRecipeSearch(recipes, query);

  const items = useMemo(() => {
    if (query.trim()) return searched.slice(0, SEARCH_RESULT_COUNT);
    return sortByCookFrequency(recipes)
      .filter((recipe) => !plannedRecipeIds.has(recipe.id))
      .slice(0, SUGGESTION_COUNT);
  }, [query, searched, recipes, plannedRecipeIds]);

  return (
    <div>
      <h3 className="font-display text-2xl font-normal leading-none">{p.suggestions}</h3>
      <p className="mt-2 text-[13px] leading-[1.5] text-[oklch(0.56_0.03_55)]">{p.suggestionsHint}</p>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={p.searchRecipes}
          className="h-9 w-full rounded-full border border-line bg-paper pl-9 pr-3 text-sm outline-none focus:border-tomato"
        />
      </div>

      <ul className="mt-4 flex flex-col gap-[10px]">
        {items.length === 0 && <li className="text-sm text-ink-4">{p.noSuggestions}</li>}
        {items.map((recipe) => {
          const collection = primaryCollection(recipe);
          const hue = collectionColor(collection);
          return (
            <li key={recipe.id}>
              <button
                type="button"
                draggable
                onDragStart={(event) => setDragData(event, { kind: 'recipe', recipeId: recipe.id })}
                onClick={() => onPick(recipe)}
                className="grid w-full cursor-grab grid-cols-[8px_1fr_auto] items-center gap-[11px] rounded-[14px] border border-[oklch(0.9_0.015_80)] px-[13px] py-3 text-left transition-colors hover:border-tomato active:cursor-grabbing"
              >
                <span className="size-2 rounded-full" style={{ background: hue }} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-[1.3] [text-wrap:pretty]">{recipe.title}</span>
                  <span
                    className="mt-[3px] block text-[11.5px] font-medium uppercase tracking-[.06em]"
                    style={{ color: hue }}
                  >
                    {collection ?? recipe.categories[0] ?? ''}
                  </span>
                </span>
                <span className="font-mono text-xs font-medium text-[oklch(0.56_0.03_55)] tabular-nums">
                  {recipe.totalTime} {t.kitchen.library.minutes}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-[26px] rounded-[18px] bg-ink p-[18px] text-cook-fg">
        <div className="text-[10.5px] font-bold uppercase tracking-[.14em] text-gold">{p.shoppingList}</div>
        <div className="mt-3 font-display text-[26px] font-normal leading-[1.1] text-white">
          <span className="font-mono text-2xl tabular-nums">{shoppingListCount}</span> {p.positions}
        </div>
        <p className="mt-2 text-sm leading-[1.55] text-[oklch(0.84_0.03_80)]">
          {plannedMealsCount > 0 ? p.fromMeals.replace('{count}', String(plannedMealsCount)) : p.emptyList}
        </p>
        <button
          type="button"
          onClick={onOpenShoppingList}
          disabled={shoppingListCount === 0}
          className="mt-4 grid h-11 w-full place-items-center rounded-full bg-gold text-sm font-bold text-gold-ink transition-colors hover:bg-[oklch(0.86_0.12_90)] disabled:opacity-50"
        >
          {p.openList}
        </button>
      </div>
    </div>
  );
}
