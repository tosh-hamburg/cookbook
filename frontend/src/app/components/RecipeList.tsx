import { useEffect, useMemo, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import type { Recipe } from '@/app/types/recipe';
import type { WeekPlan } from '@/app/types/mealplan';
import { RecipeCard } from '@/app/components/RecipeCard';
import { RecipeHero } from '@/app/components/library/RecipeHero';
import { CollectionPills } from '@/app/components/library/CollectionPills';
import { WeekBand } from '@/app/components/library/WeekBand';
import { Button } from '@/app/components/ui/button';
import { collectionsApi, type Collection } from '@/app/services/api';
import { useRecipeSearch } from '@/app/hooks/useRecipeSearch';
import { pickFeaturedRecipe } from '@/app/utils/recipeMeta';
import { useTranslation } from '@/app/i18n';

interface RecipeListProps {
  recipes: Recipe[];
  /** Suchbegriff aus dem Kopfbereich (App-weit) */
  query: string;
  weekPlan: WeekPlan;
  onSelectRecipe: (recipe: Recipe) => void;
  onCreateNew: () => void;
  /** Öffnet den URL-Import (Dialog liegt in der App) */
  onOpenImport: () => void;
  onCook: (recipe: Recipe) => void;
  onPlan: (recipe: Recipe) => void;
  onToggleFavorite: (recipe: Recipe) => void;
  onOpenPlanner: () => void;
  onCreateShoppingList: () => void;
}

/** Rezeptbibliothek (Handoff 2a): Rezept der Woche, Sammlungsleiste, Raster, Wochenband. */
export function RecipeList({
  recipes,
  query,
  weekPlan,
  onSelectRecipe,
  onCreateNew,
  onOpenImport,
  onCook,
  onPlan,
  onToggleFavorite,
  onOpenPlanner,
  onCreateShoppingList,
}: RecipeListProps) {
  const { t } = useTranslation();
  const lib = t.kitchen.library;
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());

  useEffect(() => {
    collectionsApi
      .getAll()
      .then(setCollections)
      .catch((error) => console.error('Error loading collections:', error));
  }, []);

  // Text search (client-side match plus server full-text search)
  const searchedRecipes = useRecipeSearch(recipes, query);

  const filteredRecipes = useMemo(
    () =>
      searchedRecipes.filter(
        (recipe) =>
          selectedCollections.size === 0 ||
          recipe.collections?.some((col) => selectedCollections.has(col.id)),
      ),
    [searchedRecipes, selectedCollections],
  );

  const featured = useMemo(() => pickFeaturedRecipe(recipes), [recipes]);
  const isFiltering = query.trim().length > 0 || selectedCollections.size > 0;

  const nextOpenDay = useMemo(() => {
    const index = weekPlan.days.findIndex((day) => !day.meals.dinner.recipe);
    return index === -1 ? null : t.planner.dayNames[index];
  }, [weekPlan, t]);

  const toggleCollection = (collectionId: string) => {
    setSelectedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(collectionId)) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
  };

  if (recipes.length === 0) {
    return (
      <EmptyState title={lib.empty} hint={lib.emptyHint} onCreateNew={onCreateNew} onOpenImport={onOpenImport} />
    );
  }

  return (
    <div>
      {featured && !isFiltering && (
        <RecipeHero
          recipe={featured}
          nextOpenDay={nextOpenDay}
          onCook={onCook}
          onPlan={onPlan}
          onOpen={onSelectRecipe}
        />
      )}

      {/* Block B – Sammlungsleiste */}
      <div className="flex flex-wrap items-center gap-[14px] border-t border-line pb-5 pt-[22px]">
        <h2 className="font-display text-[30px] font-normal leading-none">{lib.myCollection}</h2>
        <span className="text-sm font-medium text-ink-4">
          <b className="font-mono font-bold tabular-nums text-ink-2">{filteredRecipes.length}</b> {lib.recipesCount}
        </span>
        <span className="flex-1" />
        {collections.length > 0 && (
          <CollectionPills
            collections={collections}
            selected={selectedCollections}
            onToggle={toggleCollection}
            onClear={() => setSelectedCollections(new Set())}
          />
        )}
      </div>

      {/* Block C – Rezeptraster */}
      {filteredRecipes.length === 0 ? (
        <EmptyState title={lib.noMatch} hint={lib.noMatchHint} onCreateNew={onCreateNew} />
      ) : (
        <div className="grid grid-cols-3 gap-[26px] max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
          {filteredRecipes.map((recipe, index) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              index={index}
              onClick={() => onSelectRecipe(recipe)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}

      {/* Block D – Wochenplan-Band */}
      <WeekBand weekPlan={weekPlan} onOpenPlanner={onOpenPlanner} onCreateShoppingList={onCreateShoppingList} />
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  hint: string;
  onCreateNew: () => void;
  onOpenImport?: () => void;
}

function EmptyState({ title, hint, onCreateNew, onOpenImport }: EmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <h2 className="font-display text-[30px] font-normal leading-none">{title}</h2>
      <p className="mt-3 max-w-[440px] text-[15px] leading-[1.6] text-ink-2 [text-wrap:pretty]">{hint}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button variant="ink" size="pill" className="pl-[6px] pr-[18px]" onClick={onCreateNew}>
          <span className="grid size-[30px] place-items-center rounded-full bg-tomato">
            <Plus className="size-4 text-white" strokeWidth={2.4} />
          </span>
          {t.kitchen.nav.createRecipe}
        </Button>
        {onOpenImport && (
          <Button variant="paper" size="pill" onClick={onOpenImport}>
            <Download />
            {t.kitchen.nav.importFromUrl}
          </Button>
        )}
      </div>
    </div>
  );
}
