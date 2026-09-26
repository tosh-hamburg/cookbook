import type { MealType, PlannedDish, WeekPlan } from '@/app/types/mealplan';
import { MEAL_TYPES } from '@/app/utils/shoppingList';

/** Muss zu MAX_DISHES_PER_SLOT im Backend (lib/meal-slots.ts) passen. */
export const MAX_DISHES_PER_SLOT = 6;
const MIN_SERVINGS = 1;
const MAX_SERVINGS = 99;

export interface SlotRef {
  dayIndex: number;
  mealType: MealType;
}

export interface DishRef extends SlotRef {
  index: number;
}

export type AddCheck = 'ok' | 'duplicate' | 'full';

export function slotDishes(plan: WeekPlan, ref: SlotRef): PlannedDish[] {
  return plan.days[ref.dayIndex]?.meals[ref.mealType].dishes ?? [];
}

/** Gerichte eines Slots ersetzen; alle anderen Tage und Slots behalten ihre Referenz. */
export function withSlotDishes(plan: WeekPlan, ref: SlotRef, dishes: PlannedDish[]): WeekPlan {
  return {
    ...plan,
    days: plan.days.map((day, index) =>
      index === ref.dayIndex
        ? { ...day, meals: { ...day.meals, [ref.mealType]: { mealType: ref.mealType, dishes } } }
        : day,
    ),
  };
}

export function canAddDish(plan: WeekPlan, ref: SlotRef, recipeId: string): AddCheck {
  const dishes = slotDishes(plan, ref);
  if (dishes.some((dish) => dish.recipe.id === recipeId)) return 'duplicate';
  if (dishes.length >= MAX_DISHES_PER_SLOT) return 'full';
  return 'ok';
}

/** Gericht ans Ende des Slots hängen; bei Duplikat oder vollem Slot unverändert. */
export function addDish(plan: WeekPlan, ref: SlotRef, dish: PlannedDish): WeekPlan {
  if (canAddDish(plan, ref, dish.recipe.id) !== 'ok') return plan;
  return withSlotDishes(plan, ref, [...slotDishes(plan, ref), dish]);
}

export function removeDish(plan: WeekPlan, ref: DishRef): WeekPlan {
  const dishes = slotDishes(plan, ref);
  if (!dishes[ref.index]) return plan;
  return withSlotDishes(
    plan,
    ref,
    dishes.filter((_, index) => index !== ref.index),
  );
}

export function setDishServings(plan: WeekPlan, ref: DishRef, servings: number): WeekPlan {
  const dishes = slotDishes(plan, ref);
  if (!dishes[ref.index]) return plan;
  const clamped = Math.max(MIN_SERVINGS, Math.min(MAX_SERVINGS, servings));
  return withSlotDishes(
    plan,
    ref,
    dishes.map((dish, index) => (index === ref.index ? { ...dish, servings: clamped } : dish)),
  );
}

/** Gericht in einen anderen Slot verschieben (ans Ende); unverändert, wenn das Ziel es nicht aufnehmen kann. */
export function moveDish(plan: WeekPlan, from: DishRef, to: SlotRef): WeekPlan {
  if (from.dayIndex === to.dayIndex && from.mealType === to.mealType) return plan;
  const dish = slotDishes(plan, from)[from.index];
  if (!dish || canAddDish(plan, to, dish.recipe.id) !== 'ok') return plan;
  return addDish(removeDish(plan, from), to, dish);
}

/** Slots, deren Gerichte sich zwischen zwei Plänen unterscheiden (Vergleich per Referenz). */
export function changedSlots(prev: WeekPlan, next: WeekPlan): Array<SlotRef & { dishes: PlannedDish[] }> {
  return next.days.flatMap((day, dayIndex) =>
    MEAL_TYPES.filter((mealType) => prev.days[dayIndex]?.meals[mealType].dishes !== day.meals[mealType].dishes).map(
      (mealType) => ({ dayIndex, mealType, dishes: day.meals[mealType].dishes }),
    ),
  );
}
