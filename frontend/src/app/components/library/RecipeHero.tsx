import { Calendar, ChefHat, UtensilsCrossed } from 'lucide-react';
import type { Recipe } from '@/app/types/recipe';
import { Button } from '@/app/components/ui/button';
import { collectionColor } from '@/app/utils/collectionColors';
import { primaryCollection } from '@/app/utils/recipeMeta';
import { useTranslation } from '@/app/i18n';

interface RecipeHeroProps {
  recipe: Recipe;
  /** Nächster freier Abend dieser Woche (Wochentagsname) – bestimmt die Beschriftung des Sekundärbuttons. */
  nextOpenDay: string | null;
  onCook: (recipe: Recipe) => void;
  onPlan: (recipe: Recipe) => void;
  onOpen: (recipe: Recipe) => void;
}

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

function heroDescription(recipe: Recipe, collection: string | null): string {
  const note = (recipe.notes ?? '').trim();
  if (note) return note.length > 220 ? `${note.slice(0, 219).trimEnd()}…` : note;
  const parts = [
    collection ? `Aus deiner Sammlung „${collection}"` : null,
    recipe.categories.length ? recipe.categories.join(' · ') : null,
    `${recipe.ingredients.length} Zutaten`,
  ].filter(Boolean);
  return parts.join(' — ');
}

/** Block A der Bibliothek: „Rezept der Woche" (automatisch nach Kochhäufigkeit). */
export function RecipeHero({ recipe, nextOpenDay, onCook, onPlan, onOpen }: RecipeHeroProps) {
  const { t } = useTranslation();
  const lib = t.kitchen.library;
  const image = recipe.images?.[0];
  const collection = primaryCollection(recipe);
  const cookCount = recipe.cookCount ?? 0;
  const showCalories = recipe.caloriesPerUnit > 0;

  const kicker = `${lib.featuredKicker} · ${
    cookCount > 0 ? fill(lib.featuredAuto, { count: cookCount }) : lib.featuredNew
  }`;

  return (
    <section className="mb-[38px] grid animate-rise items-center gap-10 max-[1100px]:grid-cols-1 min-[1100px]:grid-cols-[1.05fr_.95fr]">
      <div className="max-[1100px]:order-2">
        <div className="inline-flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[.14em] text-tomato">
          <span className="h-[1.5px] w-[26px] bg-tomato" />
          {kicker}
        </div>

        <h2
          onClick={() => onOpen(recipe)}
          className="mt-4 cursor-pointer font-display text-[52px] font-normal leading-[1.05] tracking-[-0.015em] [text-wrap:balance] max-[700px]:text-[38px]"
        >
          {recipe.title}
        </h2>

        <p className="mt-4 max-w-[520px] text-[16.5px] leading-[1.6] text-ink-2 [text-wrap:pretty]">
          {heroDescription(recipe, collection)}
        </p>

        <div className="mt-[26px] flex items-center gap-[26px]">
          <Metric value={`${recipe.totalTime} ${lib.minutes}`} label={lib.total} />
          <Metric value={String(recipe.servings)} label={lib.servings} />
          {showCalories && <Metric value={String(recipe.caloriesPerUnit)} label={lib.kcalPerServing} />}
        </div>

        <div className="mt-[30px] flex flex-wrap gap-3">
          <Button variant="tomato" size="pill-lg" onClick={() => onCook(recipe)}>
            <ChefHat strokeWidth={2.2} />
            {lib.cookNow}
          </Button>
          <Button variant="inkOutline" size="pill-lg" className="px-[22px]" onClick={() => onPlan(recipe)}>
            <Calendar strokeWidth={2} />
            {nextOpenDay ? fill(lib.planOnDay, { day: nextOpenDay }) : lib.planOnAnyDay}
          </Button>
        </div>
      </div>

      <div className="relative max-[1100px]:order-1 max-[1100px]:mb-6">
        <div className="absolute -right-[14px] -bottom-[18px] left-[18px] top-[18px] rounded-[26px] bg-sage/50" />
        <div
          onClick={() => onOpen(recipe)}
          className="relative h-[380px] cursor-pointer overflow-hidden rounded-[26px] bg-photo-fallback shadow-hero max-[700px]:h-[260px]"
        >
          {image ? (
            <img src={image} alt={recipe.title} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center">
              <UtensilsCrossed className="size-14" style={{ color: collectionColor(collection) }} strokeWidth={1.4} />
            </div>
          )}
        </div>

        <div className="absolute -bottom-[22px] -left-[18px] -rotate-6 rounded-2xl bg-white px-4 py-3 shadow-note">
          <div className="text-[12.5px] font-medium leading-[1.3] text-[oklch(0.5_0.03_45)]">
            {cookCount > 0 ? (
              <>
                {lib.cookedTimes.split('{count}')[0]}
                <b className="font-mono font-bold">{cookCount}×</b>
                {lib.cookedTimes.split('{count}')[1] ?? ''}
              </>
            ) : (
              lib.notCookedYet
            )}
          </div>
          <div className="font-display text-[17px] leading-[1.2]">
            {cookCount >= 3 ? lib.familyFavorite : lib.newInCollection}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-mono text-[26px] font-bold leading-none tracking-[-0.03em] tabular-nums">{value}</div>
      <div className="mt-[5px] text-[11.5px] font-semibold uppercase tracking-[.1em] text-ink-4">{label}</div>
    </div>
  );
}
