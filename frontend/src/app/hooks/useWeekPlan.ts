import { useCallback, useEffect, useState } from 'react';
import type { Recipe } from '@/app/types/recipe';
import type { WeekPlan, MealType } from '@/app/types/mealplan';
import { createEmptyWeekPlan } from '@/app/types/mealplan';
import { mealPlansApi } from '@/app/services/api';
import { mealPlanDataToWeekPlan } from '@/app/utils/shoppingList';

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
  }, [enabled, weekStart, recipes, onLoaded]);

  const setSlot = useCallback(
    async (dayIndex: number, mealType: MealType, recipe: Recipe | null, servings: number) => {
      setWeekPlan((prev) => ({
        ...prev,
        days: prev.days.map((day, i) =>
          i === dayIndex
            ? { ...day, meals: { ...day.meals, [mealType]: { mealType, recipe, servings } } }
            : day,
        ),
      }));

      setIsSaving(true);
      try {
        await mealPlansApi.updateSlot(weekStart, dayIndex, mealType, recipe?.id ?? null, servings);
      } catch (error) {
        console.error('Error saving meal slot:', error);
        onSaveError?.();
      } finally {
        setIsSaving(false);
      }
    },
    [weekStart, onSaveError],
  );

  return { weekPlan, isLoading, isSaving, setSlot };
}
