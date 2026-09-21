import { Clock, Heart, UtensilsCrossed, Soup } from 'lucide-react';
import type { CSSProperties, MouseEvent } from 'react';
import type { Recipe } from '@/app/types/recipe';
import { collectionColor } from '@/app/utils/collectionColors';
import { primaryCollection, recipeSubtitle } from '@/app/utils/recipeMeta';
import { useTranslation } from '@/app/i18n';

interface RecipeCardProps {
  recipe: Recipe;
  index?: number;
  onClick: () => void;
  onToggleFavorite: (recipe: Recipe) => void;
}

const STAGGER_MS = 60;

/** Rezeptkarte im Raster (Handoff 2a, Block C). */
export function RecipeCard({ recipe, index = 0, onClick, onToggleFavorite }: RecipeCardProps) {
  const { t } = useTranslation();
  const image = recipe.images?.[0];
  const collection = primaryCollection(recipe);
  const hue = collectionColor(collection);
  const isFavorite = !!recipe.isFavorite;
  const showCalories = recipe.caloriesPerUnit > 0;

  const handleFavorite = (event: MouseEvent) => {
    event.stopPropagation();
    onToggleFavorite(recipe);
  };

  return (
    <article
      onClick={onClick}
      style={{ animationDelay: `${index * STAGGER_MS}ms` } as CSSProperties}
      className="group animate-rise cursor-pointer overflow-hidden rounded-[20px] bg-white shadow-card transition-[transform,box-shadow] duration-[160ms] ease-out hover:-translate-y-[3px] hover:shadow-card-hover"
    >
      <div className="relative h-[196px] bg-photo-fallback">
        {image ? (
          <img src={image} alt={recipe.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <UtensilsCrossed className="size-9" style={{ color: hue }} strokeWidth={1.6} />
          </div>
        )}

        {collection && (
          <span
            className="absolute left-3 top-3 inline-flex h-7 items-center rounded-full bg-white px-3 text-[11.5px] font-bold uppercase tracking-[.06em]"
            style={{ color: hue }}
          >
            {collection}
          </span>
        )}

        <button
          type="button"
          onClick={handleFavorite}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? t.kitchen.library.unfavorite : t.kitchen.library.favorite}
          className="absolute right-[10px] top-[10px] grid size-[34px] place-items-center rounded-full bg-white shadow-heart transition-transform hover:scale-105"
        >
          <Heart
            className="size-[17px]"
            strokeWidth={2}
            style={
              isFavorite
                ? { fill: 'var(--tomato)', stroke: 'var(--tomato)' }
                : { fill: 'none', stroke: 'oklch(0.55 0.03 45)' }
            }
          />
        </button>
      </div>

      <div className="px-5 pb-5 pt-[18px]">
        <h3 className="min-h-[55px] font-display text-[23px] font-normal leading-[1.2] tracking-[-0.01em] [text-wrap:pretty]">
          {recipe.title}
        </h3>
        <p className="mt-[6px] text-sm leading-[1.5] text-[oklch(0.52_0.03_48)]">{recipeSubtitle(recipe)}</p>

        <div className="mt-4 flex items-center gap-[18px] border-t border-dashed border-line pt-[14px] text-[13.5px] font-medium text-ink-2">
          <span className="inline-flex items-center gap-[6px]">
            <Clock className="size-[15px] text-tomato" strokeWidth={2} />
            <b className="font-mono font-medium tabular-nums">{recipe.totalTime}</b> {t.kitchen.library.minutes}
          </span>
          <span className="inline-flex items-center gap-[6px]">
            <Soup className="size-[15px] text-herb" strokeWidth={2} />
            <b className="font-mono font-medium tabular-nums">{recipe.servings}</b> {t.kitchen.library.servingsShort}
          </span>
          <span className="flex-1" />
          {showCalories ? (
            <span className="text-[13px] font-semibold text-tomato">
              <span className="font-mono tabular-nums">{recipe.caloriesPerUnit}</span> kcal
            </span>
          ) : (
            <span className="text-[12px] text-ink-4">{t.kitchen.library.nutritionOpen}</span>
          )}
        </div>
      </div>
    </article>
  );
}
