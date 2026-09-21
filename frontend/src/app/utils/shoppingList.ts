import type { Recipe } from '@/app/types/recipe';
import type { WeekPlan, MealType, AggregatedIngredient } from '@/app/types/mealplan';
import { createEmptyWeekPlan } from '@/app/types/mealplan';
import type { MealPlanData } from '@/app/services/api';
import { parseAmount } from '@/app/utils/amounts';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

// Format number nicely (avoid ugly decimals)
function formatNumber(num: number): string {
  if (num === 0) return '';
  if (Math.abs(num - Math.round(num)) < 0.01) return String(Math.round(num));

  const remainder = num % 1;
  const whole = Math.floor(num);

  if (Math.abs(remainder - 0.5) < 0.05) return whole ? `${whole}½` : '½';
  if (Math.abs(remainder - 0.25) < 0.05) return whole ? `${whole}¼` : '¼';
  if (Math.abs(remainder - 0.75) < 0.05) return whole ? `${whole}¾` : '¾';
  if (Math.abs(remainder - 0.333) < 0.03) return whole ? `${whole}⅓` : '⅓';
  if (Math.abs(remainder - 0.666) < 0.03) return whole ? `${whole}⅔` : '⅔';

  return num.toFixed(1).replace('.', ',').replace(/,0$/, '');
}

interface CollectedIngredient {
  amounts: Array<{ value: number; unit: string }>;
  sources: AggregatedIngredient['sources'];
}

function formatTotal(amounts: CollectedIngredient['amounts']): string {
  const unitGroups = amounts.reduce<Map<string, number>>((groups, { value, unit }) => {
    const key = unit.toLowerCase();
    return new Map(groups).set(key, (groups.get(key) || 0) + value);
  }, new Map());

  return Array.from(unitGroups.entries())
    .map(([unit, value]) => (value > 0 ? `${formatNumber(value)} ${unit}`.trim() : unit))
    .join(' + ');
}

/** Gleiche Zutaten aller geplanten Mahlzeiten zusammenfassen, Herkunft behalten. */
export function aggregateIngredients(weekPlan: WeekPlan): AggregatedIngredient[] {
  const collected = new Map<string, CollectedIngredient>();

  for (const day of weekPlan.days) {
    for (const mealType of MEAL_TYPES) {
      const meal = day.meals[mealType];
      if (!meal.recipe) continue;

      const scaleFactor = meal.servings / (meal.recipe.servings || 1);
      for (const ing of meal.recipe.ingredients) {
        const key = ing.name.toLowerCase().trim();
        const parsed = parseAmount(ing.amount);
        const entry = collected.get(key) ?? { amounts: [], sources: [] };
        collected.set(key, {
          amounts: [...entry.amounts, { value: (parsed.value ?? 0) * scaleFactor, unit: parsed.rest }],
          sources: [
            ...entry.sources,
            { recipeTitle: meal.recipe.title, servings: meal.servings, originalAmount: ing.amount },
          ],
        });
      }
    }
  }

  return Array.from(collected.entries())
    .map(([name, data]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      totalAmount: formatTotal(data.amounts),
      sources: data.sources,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Backend-Wochenplan in das WeekPlan-Modell übersetzen; volle Rezepte bevorzugen. */
export function mealPlanDataToWeekPlan(data: MealPlanData, weekStart: Date, recipes: Recipe[]): WeekPlan {
  const empty = createEmptyWeekPlan(weekStart);

  const days = empty.days.map((day, dayIndex) => {
    const slots = data.meals.filter((m) => m.dayIndex === dayIndex && m.recipe);
    if (slots.length === 0) return day;

    const meals = slots.reduce(
      (acc, slot) => {
        const partial = slot.recipe!;
        const recipe: Recipe = recipes.find((r) => r.id === partial.id) ?? {
          id: partial.id,
          title: partial.title,
          images: partial.images,
          ingredients: partial.ingredients,
          instructions: '',
          prepTime: 0,
          restTime: 0,
          cookTime: 0,
          totalTime: partial.totalTime,
          servings: partial.servings,
          caloriesPerUnit: 0,
          weightUnit: '',
          categories: partial.categories,
          createdAt: '',
        };
        return {
          ...acc,
          [slot.mealType]: { mealType: slot.mealType, recipe, servings: slot.servings },
        };
      },
      day.meals,
    );

    return { ...day, meals };
  });

  return { ...empty, days };
}

export function countPlannedMeals(weekPlan: WeekPlan): number {
  return weekPlan.days.reduce(
    (sum, day) => sum + MEAL_TYPES.filter((type) => day.meals[type].recipe).length,
    0,
  );
}

export function plannedRecipeIds(weekPlan: WeekPlan): Set<string> {
  return new Set(
    weekPlan.days.flatMap((day) =>
      MEAL_TYPES.map((type) => day.meals[type].recipe?.id).filter((id): id is string => !!id),
    ),
  );
}
