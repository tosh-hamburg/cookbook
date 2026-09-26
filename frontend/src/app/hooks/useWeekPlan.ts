import { useCallback, useEffect, useState } from 'react';
import type { Recipe } from '@/app/types/recipe';
import type { WeekPlan } from '@/app/types/mealplan';
import { createEmptyWeekPlan } from '@/app/types/mealplan';
import { mealPlansApi } from '@/app/services/api';
import { mealPlanDataToWeekPlan } from '@/app/utils/shoppingList';
import { changedSlots } from '@/app/utils/planSlots';

interface UseWeekPlanOptions {
  /** false = nicht laden (z. B. solange niemand angemeldet ist) */
  enabled?: boolean;
  onLoaded?: (data: { sentIngredients: string[]; excludedIngredients: string[] }) => void;
  onSaveError?: () => void;
}

/**
 * Lädt den Wochenplan einer Woche und schreibt Slot-Änderungen optimistisch
 * (lokal sofort, dann Backend). Wird von Bibliothek (Wochenband) und
 * Wochenplaner gemeinsam genutzt.
 */
export function useWeekPlan(weekStart: Date, recipes: Recipe[], options: UseWeekPlanOptions = {}) {
  const { enabled = true, onLoaded, onSaveError } = options;
  const [weekPlan, setWeekPlan] = useState<WeekPlan>(() => createEmptyWeekPlan(weekStart));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await mealPlansApi.getByWeek(weekStart);
        if (cancelled) return;
        setWeekPlan(mealPlanDataToWeekPlan(data, weekStart, recipes));
        onLoaded?.({
          sentIngredients: data.sentIngredients || [],
          excludedIngredients: data.excludedIngredients || [],
        });
      } catch (error) {
        console.error('Error loading meal plan:', error);
        if (cancelled) return;
        setWeekPlan(createEmptyWeekPlan(weekStart));
        onLoaded?.({ sentIngredients: [], excludedIngredients: [] });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [enabled, weekStart, recipes, onLoaded, reloadToken]);

  /**
   * Plan per reiner Funktion ändern: lokal sofort übernehmen, dann alle
   * geänderten Slots in einem Request (eine Transaktion) speichern — beim
   * Verschieben also Quelle und Ziel gemeinsam. Schlägt das fehl, wird der
   * Serverstand neu geladen.
   */
  const updatePlan = useCallback(
    async (transform: (plan: WeekPlan) => WeekPlan) => {
      const next = transform(weekPlan);
      const changes = changedSlots(weekPlan, next);
      if (changes.length === 0) return;
      setWeekPlan(next);

      setIsSaving(true);
      try {
        await mealPlansApi.replaceSlots(
          weekStart,
          changes.map(({ dayIndex, mealType, dishes }) => ({
            dayIndex,
            mealType,
            dishes: dishes.map((dish) => ({ recipeId: dish.recipe.id, servings: dish.servings })),
          })),
        );
      } catch (error) {
        console.error('Error saving meal slot:', error);
        onSaveError?.();
        setReloadToken((token) => token + 1);
      } finally {
        setIsSaving(false);
      }
    },
    [weekPlan, weekStart, onSaveError],
  );

  return { weekPlan, isLoading, isSaving, updatePlan };
}
