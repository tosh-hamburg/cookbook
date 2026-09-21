import { Check, RotateCcw, Send, ShoppingCart, Trash2 } from 'lucide-react';
import type { AggregatedIngredient } from '@/app/types/mealplan';
import { Button } from '@/app/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/components/ui/tooltip';
import { useTranslation } from '@/app/i18n';

interface ShoppingListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newIngredients: AggregatedIngredient[];
  sentIngredients: AggregatedIngredient[];
  excludedNames: string[];
  plannedMealsCount: number;
  onToggleExclusion: (name: string) => void;
  onResetExcluded: () => void;
  onResetSent: () => void;
  onSend: (onlyNew: boolean) => void;
}

/** Einkaufszettel (Handoff 3c „Zettel öffnen"): zusammengefasste Zutaten, Versand an Gemini. */
export function ShoppingListSheet({
  open,
  onOpenChange,
  newIngredients,
  sentIngredients,
  excludedNames,
  plannedMealsCount,
  onToggleExclusion,
  onResetExcluded,
  onResetSent,
  onSend,
}: ShoppingListSheetProps) {
  const { t } = useTranslation();
  const p = t.kitchen.plan;
  const total = newIngredients.length + sentIngredients.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto bg-paper p-0 sm:max-w-[480px]">
        <SheetHeader className="border-b border-line px-6 pb-5 pt-6">
          <div className="text-[10.5px] font-bold uppercase tracking-[.14em] text-tomato">{p.shoppingList}</div>
          <SheetTitle className="font-display text-[30px] font-normal leading-none">
            <span className="font-mono text-[26px] tabular-nums">{total}</span> {p.positions}
          </SheetTitle>
          <SheetDescription className="text-ink-2">
            {plannedMealsCount > 0 ? p.fromMeals.replace('{count}', String(plannedMealsCount)) : p.emptyList}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-6 py-5">
          {newIngredients.length > 0 && (
            <IngredientGroup
              title={`${t.planner.newIngredients} (${newIngredients.length})`}
              icon={<Send className="size-4 text-tomato" />}
              items={newIngredients}
              onRemove={onToggleExclusion}
            />
          )}

          {sentIngredients.length > 0 && (
            <IngredientGroup
              title={`${t.planner.alreadySent} (${sentIngredients.length})`}
              icon={<Check className="size-4 text-herb" />}
              items={sentIngredients}
              onRemove={onToggleExclusion}
              muted
            />
          )}

          {excludedNames.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-ink-4">
                {p.excluded} ({excludedNames.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {excludedNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onToggleExclusion(name)}
                    title={p.restore}
                    className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-line px-3 text-xs text-ink-4 line-through hover:border-tomato hover:text-ink hover:no-underline"
                  >
                    <RotateCcw className="size-3" />
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {total === 0 && excludedNames.length === 0 && (
            <p className="py-10 text-center text-sm text-ink-4">{t.planner.addRecipesFirst}</p>
          )}
        </div>

        <div className="sticky bottom-0 mt-auto flex flex-col gap-2 border-t border-line bg-paper px-6 py-4">
          {newIngredients.length > 0 && (
            <Button variant="tomato" size="pill-md" className="w-full" onClick={() => onSend(true)}>
              <Send strokeWidth={2} />
              {t.planner.sendNewIngredients} ({newIngredients.length})
            </Button>
          )}
          {total > 0 && (
            <Button variant="inkOutline" size="pill-md" className="w-full" onClick={() => onSend(false)}>
              <ShoppingCart strokeWidth={2} />
              {t.planner.sendAll} ({total})
            </Button>
          )}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1 text-xs text-ink-4">
            {sentIngredients.length > 0 && (
              <button type="button" onClick={onResetSent} className="hover:text-ink hover:underline">
                {t.planner.resetSent}
              </button>
            )}
            {excludedNames.length > 0 && (
              <button type="button" onClick={onResetExcluded} className="hover:text-ink hover:underline">
                {t.planner.restoreDeleted} ({excludedNames.length})
              </button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface IngredientGroupProps {
  title: string;
  icon: React.ReactNode;
  items: AggregatedIngredient[];
  onRemove: (name: string) => void;
  muted?: boolean;
}

function IngredientGroup({ title, icon, items, onRemove, muted }: IngredientGroupProps) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-ink-4">
        {icon}
        {title}
      </div>
      <TooltipProvider>
        <ul className={muted ? 'opacity-60' : ''}>
          {items.map((ingredient) => (
            <li key={ingredient.name}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="group grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-line-soft py-2">
                    <span className="truncate text-[15px]">{ingredient.name}</span>
                    <span className="font-mono text-[13.5px] font-medium text-ink-2 tabular-nums">
                      {ingredient.totalAmount || '–'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(ingredient.name)}
                      title={t.kitchen.plan.remove}
                      aria-label={t.kitchen.plan.remove}
                      className="grid size-6 place-items-center rounded-full text-ink-4 opacity-0 transition-opacity hover:bg-line-soft hover:text-tomato group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <p className="mb-1 text-xs font-medium">{t.planner.usedIn}</p>
                  {ingredient.sources.map((source, index) => (
                    <p key={index} className="text-xs">
                      • {source.recipeTitle} ({source.servings}P): {source.originalAmount}
                    </p>
                  ))}
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      </TooltipProvider>
    </div>
  );
}
