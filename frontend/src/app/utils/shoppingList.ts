import type { Recipe } from '@/app/types/recipe';
import type { WeekPlan, MealType, AggregatedIngredient, PlannedDish } from '@/app/types/mealplan';
import { createEmptyWeekPlan } from '@/app/types/mealplan';
import type { MealPlanData, MealSlotData } from '@/app/services/api';
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

  for (const dish of allDishes(weekPlan)) {
    const scaleFactor = dish.servings / (dish.recipe.servings || 1);
    for (const ing of dish.recipe.ingredients) {
      const key = ing.name.toLowerCase().trim();
      const parsed = parseAmount(ing.amount);
      const entry = collected.get(key) ?? { amounts: [], sources: [] };
      collected.set(key, {
        amounts: [...entry.amounts, { value: (parsed.value ?? 0) * scaleFactor, unit: parsed.rest }],
        sources: [
          ...entry.sources,
          { recipeTitle: dish.recipe.title, servings: dish.servings, originalAmount: ing.amount },
        ],
      });
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

type PartialRecipe = NonNullable<MealSlotData['recipe']>;

function toRecipe(partial: PartialRecipe, recipes: Recipe[]): Recipe {
  return (
    recipes.find((r) => r.id === partial.id) ?? {
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
    }
  );
}

/** Backend-Wochenplan in das WeekPlan-Modell übersetzen; volle Rezepte bevorzugen. */
export function mealPlanDataToWeekPlan(data: MealPlanData, weekStart: Date, recipes: Recipe[]): WeekPlan {
  const empty = createEmptyWeekPlan(weekStart);

  const days = empty.days.map((day, dayIndex) => {
    const meals = MEAL_TYPES.reduce((acc, mealType) => {
      const dishes: PlannedDish[] = data.meals
        .filter((m) => m.dayIndex === dayIndex && m.mealType === mealType && m.recipe)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((m) => ({ recipe: toRecipe(m.recipe!, recipes), servings: m.servings }));
      return dishes.length > 0 ? { ...acc, [mealType]: { mealType, dishes } } : acc;
    }, day.meals);

    return { ...day, meals };
  });

  return { ...empty, days };
}

/** Alle geplanten Gerichte der Woche, Tag für Tag, Frühstück bis Abend. */
export function allDishes(weekPlan: WeekPlan): PlannedDish[] {
  return weekPlan.days.flatMap((day) => MEAL_TYPES.flatMap((type) => day.meals[type].dishes));
}

export function countPlannedMeals(weekPlan: WeekPlan): number {
  return allDishes(weekPlan).length;
}

export function plannedRecipeIds(weekPlan: WeekPlan): Set<string> {
  return new Set(allDishes(weekPlan).map((dish) => dish.recipe.id));
}
