import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import type { Recipe } from '@/app/types/recipe';
import type { MealType } from '@/app/types/mealplan';
import { getCurrentWeekStart, getNextWeekStart } from '@/app/types/mealplan';
import { Button } from '@/app/components/ui/button';
import { PlannerGrid } from '@/app/components/planner/PlannerGrid';
import { PlannerSuggestions } from '@/app/components/planner/PlannerSuggestions';
import { ShoppingListSheet } from '@/app/components/planner/ShoppingListSheet';
import type { PlannerDragData } from '@/app/components/planner/dragData';
import { mealPlansApi } from '@/app/services/api';
import { useWeekPlan } from '@/app/hooks/useWeekPlan';
import { aggregateIngredients, countPlannedMeals, plannedRecipeIds } from '@/app/utils/shoppingList';
import { addDays, formatDaySpan, getWeekNumber } from '@/app/utils/week';
import { useTranslation } from '@/app/i18n';

interface WeeklyPlannerProps {
  recipes: Recipe[];
  onViewRecipe: (recipe: Recipe) => void;
  geminiPrompt?: string;
  excludedIngredients: Set<string>;
  onExcludedIngredientsChange: (excluded: Set<string>) => void;
  currentWeekStart: Date;
  onWeekStartChange: (date: Date) => void;
  sentIngredients: Set<string>;
  onSentIngredientsChange: (sent: Set<string>) => void;
  /** Einkaufszettel direkt geöffnet anzeigen (Einstieg über „Einkaufszettel erzeugen") */
  shoppingListOpen: boolean;
  onShoppingListOpenChange: (open: boolean) => void;
}

const DEFAULT_GEMINI_PROMPT =
  'Füge bitte folgende Zutaten zu meiner Einkaufsliste in Google Keep hinzu (erstelle die Liste "Einkaufsliste" falls sie nicht existiert):';
const DEFAULT_SLOT_SERVINGS = 2;

/** Wochenplaner (Handoff 3c). */
export function WeeklyPlanner({
  recipes,
  onViewRecipe,
  geminiPrompt,
  excludedIngredients,
  onExcludedIngredientsChange,
  currentWeekStart,
  onWeekStartChange,
  sentIngredients,
  onSentIngredientsChange,
  shoppingListOpen,
  onShoppingListOpenChange,
}: WeeklyPlannerProps) {
  const { t, language } = useTranslation();
  const p = t.kitchen.plan;
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const onLoaded = useCallback(
    (data: { sentIngredients: string[]; excludedIngredients: string[] }) => {
      onSentIngredientsChange(new Set(data.sentIngredients));
      onExcludedIngredientsChange(new Set(data.excludedIngredients));
    },
    [onSentIngredientsChange, onExcludedIngredientsChange],
  );
  const onSaveError = useCallback(() => toast.error(t.planner.saveError), [t]);
  const { weekPlan, isLoading, isSaving, setSlot } = useWeekPlan(currentWeekStart, recipes, { onLoaded, onSaveError });

  useEffect(() => setSelectedSlot(null), [currentWeekStart]);

  const recipeById = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);
  const planned = useMemo(() => plannedRecipeIds(weekPlan), [weekPlan]);
  const plannedMealsCount = useMemo(() => countPlannedMeals(weekPlan), [weekPlan]);

  const allIngredients = useMemo(() => aggregateIngredients(weekPlan), [weekPlan]);
  const listIngredients = useMemo(
    () => allIngredients.filter((ing) => !excludedIngredients.has(ing.name.toLowerCase())),
    [allIngredients, excludedIngredients],
  );
  const newIngredients = useMemo(
    () => listIngredients.filter((ing) => !sentIngredients.has(ing.name.toLowerCase())),
    [listIngredients, sentIngredients],
  );
  const alreadySent = useMemo(
    () => listIngredients.filter((ing) => sentIngredients.has(ing.name.toLowerCase())),
    [listIngredients, sentIngredients],
  );

  const parseSlot = (key: string): { dayIndex: number; mealType: MealType } => {
    const [day, meal] = key.split(':');
    return { dayIndex: Number(day), mealType: meal as MealType };
  };

  const placeRecipe = (dayIndex: number, mealType: MealType, recipe: Recipe) => {
    setSlot(dayIndex, mealType, recipe, recipe.servings || DEFAULT_SLOT_SERVINGS);
    setSelectedSlot(null);
  };

  const pickSuggestion = (recipe: Recipe) => {
    if (!selectedSlot) {
      toast(p.selectSlotToast);
      return;
    }
    const { dayIndex, mealType } = parseSlot(selectedSlot);
    placeRecipe(dayIndex, mealType, recipe);
  };

  const handleDrop = (dayIndex: number, mealType: MealType, data: PlannerDragData) => {
    if (data.kind === 'recipe') {
      const recipe = recipeById.get(data.recipeId);
      if (recipe) placeRecipe(dayIndex, mealType, recipe);
      return;
    }
    if (data.dayIndex === dayIndex && data.mealType === mealType) return;
    const source = weekPlan.days[data.dayIndex].meals[data.mealType];
    const target = weekPlan.days[dayIndex].meals[mealType];
    if (!source.recipe) return;
    setSlot(dayIndex, mealType, source.recipe, source.servings);
    setSlot(data.dayIndex, data.mealType, target.recipe, target.recipe ? target.servings : DEFAULT_SLOT_SERVINGS);
    setSelectedSlot(null);
  };

  const changeServings = (dayIndex: number, mealType: MealType, delta: number) => {
    const slot = weekPlan.days[dayIndex].meals[mealType];
    if (!slot.recipe) return;
    setSlot(dayIndex, mealType, slot.recipe, Math.max(1, Math.min(99, slot.servings + delta)));
  };

  const toggleExclusion = async (name: string) => {
    const key = name.toLowerCase();
    const next = new Set(excludedIngredients);
    const wasExcluded = next.has(key);
    if (wasExcluded) next.delete(key);
    else next.add(key);
    onExcludedIngredientsChange(next);
    try {
      if (wasExcluded) await mealPlansApi.restoreIngredient(currentWeekStart, key);
      else await mealPlansApi.excludeIngredients(currentWeekStart, [key]);
    } catch (error) {
      console.error('Error toggling ingredient exclusion:', error);
      onExcludedIngredientsChange(excludedIngredients);
      toast.error(t.planner.ingredientListError);
    }
  };

  const resetExcluded = async () => {
    try {
      await mealPlansApi.resetExcludedIngredients(currentWeekStart);
      onExcludedIngredientsChange(new Set());
      toast.success(t.planner.excludedReset);
    } catch (error) {
      console.error('Error resetting excluded ingredients:', error);
      toast.error(t.planner.saveError);
    }
  };

  const resetSent = async () => {
    try {
      await mealPlansApi.resetSentIngredients(currentWeekStart);
      onSentIngredientsChange(new Set());
      toast.success(t.planner.sentReset);
    } catch (error) {
      console.error('Error resetting sent ingredients:', error);
      toast.error(t.planner.saveError);
    }
  };

  // Copies the prompt for Gemini/Google Keep to the clipboard and marks the ingredients as sent
  const sendToGemini = async (onlyNew: boolean) => {
    const toSend = onlyNew ? newIngredients : listIngredients;
    if (toSend.length === 0) {
      toast.error(t.planner.noIngredients, { description: onlyNew ? t.planner.allSent : t.planner.addRecipesFirst });
      return;
    }
    const list = toSend.map((ing) => (ing.totalAmount ? `${ing.totalAmount} ${ing.name}` : ing.name)).join('\n');
    const prompt = `${geminiPrompt || DEFAULT_GEMINI_PROMPT}\n\n${list}`;

    try {
      await navigator.clipboard.writeText(prompt);
      try {
        const result = await mealPlansApi.markIngredientsSent(
          currentWeekStart,
          toSend.map((ing) => ing.name.toLowerCase()),
        );
        onSentIngredientsChange(new Set(result.sentIngredients));
      } catch (error) {
        console.error('Error marking ingredients as sent:', error);
      }
      toast.success(t.planner.ingredientsCopied, { description: `${toSend.length} ${t.planner.ingredientsSentTo}` });
      window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Clipboard error:', error);
      toast.error(t.recipeDetail.copyError);
    }
  };

  const goToWeek = (date: Date) => onWeekStartChange(date);
  const isCurrentWeek = currentWeekStart.getTime() === getCurrentWeekStart().getTime();
  const isNextWeek = currentWeekStart.getTime() === getNextWeekStart().getTime();

  return (
    <div className="animate-rise">
      {/* Kopfzeile des Planers */}
      <div className="flex flex-wrap items-center gap-[18px] max-[900px]:gap-3">
        <h1 className="font-display text-[30px] font-normal leading-none">{p.title}</h1>
        <div className="ml-[10px] flex items-center gap-[6px] max-[900px]:ml-0">
          <Button variant="paper" size="icon-round" onClick={() => goToWeek(addDays(currentWeekStart, -7))} aria-label="‹">
            <ChevronLeft className="size-4 text-ink-2" strokeWidth={2.2} />
          </Button>
          <span className="px-[6px] font-mono text-[15px] font-semibold tabular-nums">
            {t.planner.calendarWeek} {getWeekNumber(currentWeekStart)}
          </span>
          <Button variant="paper" size="icon-round" onClick={() => goToWeek(addDays(currentWeekStart, 7))} aria-label="›">
            <ChevronRight className="size-4 text-ink-2" strokeWidth={2.2} />
          </Button>
        </div>
        <span className="text-sm font-medium text-ink-4">{formatDaySpan(currentWeekStart, language)}</span>
        {!isCurrentWeek && (
          <button type="button" onClick={() => goToWeek(getCurrentWeekStart())} className="text-[13px] font-semibold text-tomato hover:underline">
            {t.planner.thisWeek}
          </button>
        )}
        {!isNextWeek && (
          <button type="button" onClick={() => goToWeek(getNextWeekStart())} className="text-[13px] font-semibold text-tomato hover:underline">
            {t.planner.nextWeek}
          </button>
        )}
        {isSaving && <Loader2 className="size-4 animate-spin text-ink-4" />}
        <span className="flex-1" />
        <span className="text-[13.5px] font-medium text-[oklch(0.5_0.03_48)] max-[1100px]:hidden">
          {selectedSlot ? p.hintSlotPicked : p.hintPickSlot}
        </span>
        <Button variant="ink" size="pill" onClick={() => onShoppingListOpenChange(true)} disabled={listIngredients.length === 0}>
          <ShoppingCart strokeWidth={2} />
          {t.kitchen.library.createShoppingList}
        </Button>
      </div>

      {/* Raster + rechte Spalte */}
      <div className="mt-[26px] flex gap-8 max-[1100px]:flex-col">
        <div className="min-w-0 flex-1 overflow-x-auto pb-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-ink-4">
              <Loader2 className="mr-2 size-5 animate-spin" />
              {t.planner.planLoading}
            </div>
          ) : (
            <PlannerGrid
              weekPlan={weekPlan}
              selectedSlot={selectedSlot}
              onSelectSlot={setSelectedSlot}
              onDrop={handleDrop}
              onRemove={(dayIndex, mealType) => setSlot(dayIndex, mealType, null, DEFAULT_SLOT_SERVINGS)}
              onChangeServings={changeServings}
              onViewRecipe={onViewRecipe}
              disabled={isSaving}
            />
          )}
        </div>

        <aside className="w-[330px] flex-none rounded-[22px] bg-white px-6 pb-9 pt-6 shadow-panel max-[1100px]:w-full">
          <PlannerSuggestions
            recipes={recipes}
            plannedRecipeIds={planned}
            onPick={pickSuggestion}
            shoppingListCount={listIngredients.length}
            plannedMealsCount={plannedMealsCount}
            onOpenShoppingList={() => onShoppingListOpenChange(true)}
          />
        </aside>
      </div>

      <ShoppingListSheet
        open={shoppingListOpen}
        onOpenChange={onShoppingListOpenChange}
        newIngredients={newIngredients}
        sentIngredients={alreadySent}
        excludedNames={Array.from(excludedIngredients)}
        plannedMealsCount={plannedMealsCount}
        onToggleExclusion={toggleExclusion}
        onResetExcluded={resetExcluded}
        onResetSent={resetSent}
        onSend={sendToGemini}
      />
    </div>
  );
}
