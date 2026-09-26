import { describe, expect, test } from 'vitest';
import type { Recipe } from '@/app/types/recipe';
import { createEmptyWeekPlan, type WeekPlan } from '@/app/types/mealplan';
import {
  MAX_DISHES_PER_SLOT,
  addDish,
  canAddDish,
  changedSlots,
  moveDish,
  removeDish,
  setDishServings,
  slotDishes,
} from './planSlots';

function recipe(id: string, servings = 4): Recipe {
  return {
    id,
    title: `Rezept ${id}`,
    images: [],
    ingredients: [],
    instructions: '',
    prepTime: 0,
    restTime: 0,
    cookTime: 0,
    totalTime: 30,
    servings,
    caloriesPerUnit: 0,
    weightUnit: '',
    categories: [],
    createdAt: '',
  };
}

const MONDAY = new Date(2026, 8, 21);
const dinnerMon = { dayIndex: 0, mealType: 'dinner' } as const;
const lunchTue = { dayIndex: 1, mealType: 'lunch' } as const;

function planWith(...ids: string[]): WeekPlan {
  return ids.reduce(
    (plan, id) => addDish(plan, dinnerMon, { recipe: recipe(id), servings: 2 }),
    createEmptyWeekPlan(MONDAY),
  );
}

describe('addDish', () => {
  test('hängt Gerichte in Reihenfolge an (Hauptgericht, dann Nachtisch)', () => {
    const plan = planWith('main', 'dessert');
    expect(slotDishes(plan, dinnerMon).map((d) => d.recipe.id)).toEqual(['main', 'dessert']);
  });

  test('verändert den Ausgangsplan nicht', () => {
    const empty = createEmptyWeekPlan(MONDAY);
    addDish(empty, dinnerMon, { recipe: recipe('a'), servings: 2 });
    expect(slotDishes(empty, dinnerMon)).toEqual([]);
  });

  test('lässt andere Slots unverändert (gleiche Referenz)', () => {
    const before = planWith('a');
    const after = addDish(before, dinnerMon, { recipe: recipe('b'), servings: 2 });
    expect(after.days[1]).toBe(before.days[1]);
    expect(after.days[0].meals.lunch).toBe(before.days[0].meals.lunch);
  });

  test('ignoriert dasselbe Rezept ein zweites Mal im selben Slot', () => {
    const plan = planWith('a');
    expect(addDish(plan, dinnerMon, { recipe: recipe('a'), servings: 2 })).toBe(plan);
  });

  test('ignoriert Gerichte über der Höchstzahl', () => {
    const ids = Array.from({ length: MAX_DISHES_PER_SLOT }, (_, i) => `r${i}`);
    const full = planWith(...ids);
    expect(addDish(full, dinnerMon, { recipe: recipe('extra'), servings: 2 })).toBe(full);
  });
});

describe('canAddDish', () => {
  test('meldet ok, duplicate und full', () => {
    expect(canAddDish(planWith('a'), dinnerMon, 'b')).toBe('ok');
    expect(canAddDish(planWith('a'), dinnerMon, 'a')).toBe('duplicate');
    const ids = Array.from({ length: MAX_DISHES_PER_SLOT }, (_, i) => `r${i}`);
    expect(canAddDish(planWith(...ids), dinnerMon, 'x')).toBe('full');
  });
});

describe('removeDish', () => {
  test('entfernt nur das gewählte Gericht', () => {
    const plan = removeDish(planWith('main', 'dessert'), { ...dinnerMon, index: 0 });
    expect(slotDishes(plan, dinnerMon).map((d) => d.recipe.id)).toEqual(['dessert']);
  });

  test('ignoriert einen ungültigen Index', () => {
    const plan = planWith('a');
    expect(removeDish(plan, { ...dinnerMon, index: 5 })).toBe(plan);
  });
});

describe('setDishServings', () => {
  test('ändert die Portionen eines Gerichts und begrenzt auf 1–99', () => {
    const plan = planWith('main', 'dessert');
    expect(slotDishes(setDishServings(plan, { ...dinnerMon, index: 1 }, 6), dinnerMon)[1].servings).toBe(6);
    expect(slotDishes(setDishServings(plan, { ...dinnerMon, index: 0 }, 0), dinnerMon)[0].servings).toBe(1);
    expect(slotDishes(setDishServings(plan, { ...dinnerMon, index: 0 }, 120), dinnerMon)[0].servings).toBe(99);
  });
});

describe('moveDish', () => {
  test('verschiebt ein Gericht ans Ende eines anderen Slots', () => {
    const start = addDish(planWith('main', 'dessert'), lunchTue, { recipe: recipe('soup'), servings: 3 });
    const plan = moveDish(start, { ...dinnerMon, index: 1 }, lunchTue);

    expect(slotDishes(plan, dinnerMon).map((d) => d.recipe.id)).toEqual(['main']);
    expect(slotDishes(plan, lunchTue).map((d) => d.recipe.id)).toEqual(['soup', 'dessert']);
    expect(slotDishes(plan, lunchTue)[1].servings).toBe(2);
  });

  test('tut nichts beim Ablegen im selben Slot', () => {
    const plan = planWith('a', 'b');
    expect(moveDish(plan, { ...dinnerMon, index: 0 }, dinnerMon)).toBe(plan);
  });

  test('tut nichts, wenn das Ziel dasselbe Rezept schon enthält', () => {
    const start = addDish(planWith('a'), lunchTue, { recipe: recipe('a'), servings: 2 });
    expect(moveDish(start, { ...dinnerMon, index: 0 }, lunchTue)).toBe(start);
  });
});

describe('changedSlots', () => {
  test('liefert genau die geänderten Slots mit ihren Gerichten', () => {
    const before = addDish(planWith('main', 'dessert'), lunchTue, { recipe: recipe('soup'), servings: 3 });
    const after = moveDish(before, { ...dinnerMon, index: 1 }, lunchTue);

    const changes = changedSlots(before, after);
    expect(changes.map(({ dayIndex, mealType, dishes }) => [dayIndex, mealType, dishes.length])).toEqual([
      [0, 'dinner', 1],
      [1, 'lunch', 2],
    ]);
  });

  test('ist leer, wenn nichts geändert wurde', () => {
    const plan = planWith('a');
    expect(changedSlots(plan, plan)).toEqual([]);
  });
});
