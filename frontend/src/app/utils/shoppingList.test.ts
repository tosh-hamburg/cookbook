import { describe, expect, test } from 'vitest';
import type { Recipe } from '@/app/types/recipe';
import type { MealPlanData, MealSlotData } from '@/app/services/api';
import { aggregateIngredients, countPlannedMeals, mealPlanDataToWeekPlan, plannedRecipeIds } from './shoppingList';

const MONDAY = new Date(2026, 8, 21);

function slotData(dayIndex: number, mealType: MealSlotData['mealType'], position: number, id: string): MealSlotData {
  return {
    dayIndex,
    mealType,
    position,
    servings: 4,
    recipe: {
      id,
      title: `Rezept ${id}`,
      images: [],
      ingredients: [{ name: 'Zucker', amount: '100 g' }],
      servings: 2,
      totalTime: 20,
      categories: [],
    },
  };
}

function planData(meals: MealSlotData[]): MealPlanData {
  return { id: 'p', weekStart: MONDAY.toISOString(), sentIngredients: [], excludedIngredients: [], meals };
}

describe('mealPlanDataToWeekPlan', () => {
  test('sammelt mehrere Gerichte eines Slots nach Position', () => {
    const plan = mealPlanDataToWeekPlan(
      planData([slotData(0, 'dinner', 1, 'dessert'), slotData(0, 'dinner', 0, 'main')]),
      MONDAY,
      [],
    );

    expect(plan.days[0].meals.dinner.dishes.map((d) => d.recipe.id)).toEqual(['main', 'dessert']);
    expect(plan.days[0].meals.lunch.dishes).toEqual([]);
  });

  test('bevorzugt das vollständige Rezept aus der Rezeptliste', () => {
    const full = { id: 'main', title: 'Voll', instructions: 'x' } as Recipe;
    const plan = mealPlanDataToWeekPlan(planData([slotData(0, 'dinner', 0, 'main')]), MONDAY, [full]);
    expect(plan.days[0].meals.dinner.dishes[0].recipe).toBe(full);
  });

  test('überspringt Einträge ohne Rezept (gelöschtes Rezept)', () => {
    const plan = mealPlanDataToWeekPlan(planData([{ ...slotData(2, 'lunch', 0, 'x'), recipe: null }]), MONDAY, []);
    expect(plan.days[2].meals.lunch.dishes).toEqual([]);
  });
});

describe('Auswertung über alle Gerichte', () => {
  const plan = mealPlanDataToWeekPlan(
    planData([slotData(0, 'dinner', 0, 'main'), slotData(0, 'dinner', 1, 'dessert'), slotData(3, 'lunch', 0, 'main')]),
    MONDAY,
    [],
  );

  test('zählt jedes Gericht als geplante Mahlzeit', () => {
    expect(countPlannedMeals(plan)).toBe(3);
  });

  test('kennt alle geplanten Rezepte', () => {
    expect(plannedRecipeIds(plan)).toEqual(new Set(['main', 'dessert']));
  });

  test('summiert Zutaten aller Gerichte, skaliert auf die Portionen', () => {
    const [sugar] = aggregateIngredients(plan);
    expect(sugar.name).toBe('Zucker');
    expect(sugar.totalAmount).toBe('600 g');
    expect(sugar.sources).toHaveLength(3);
  });
});
