/**
 * Validierung und Zeilenaufbau für Wochenplan-Slots. Ein Slot (Tag × Mahlzeit)
 * kann mehrere Gerichte enthalten (z. B. Hauptgericht und Nachtisch); jedes
 * Gericht ist eine MealSlot-Zeile, `position` legt die Reihenfolge fest.
 */

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MAX_DISHES_PER_SLOT = 6;
export const MAX_SERVINGS = 99;
export const DEFAULT_SERVINGS = 2;

export interface SlotTarget {
  dayIndex: number;
  mealType: MealType;
}

export interface DishInput {
  recipeId: string;
  servings: number;
}

export interface MealSlotRow extends SlotTarget, DishInput {
  mealPlanId: string;
  position: number;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMealType(value: unknown): value is MealType {
  return typeof value === 'string' && (MEAL_TYPES as readonly string[]).includes(value);
}

function isDayIndex(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 6;
}

function isServings(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_SERVINGS;
}

export function parseSlotTarget(body: unknown): ParseResult<SlotTarget> {
  if (!isRecord(body) || !isDayIndex(body.dayIndex) || !isMealType(body.mealType)) {
    return { ok: false, error: 'Ungültige Slot-Parameter' };
  }
  return { ok: true, value: { dayIndex: body.dayIndex, mealType: body.mealType } };
}

export function parseDish(raw: unknown): ParseResult<DishInput> {
  if (!isRecord(raw) || typeof raw.recipeId !== 'string' || raw.recipeId.length === 0) {
    return { ok: false, error: 'Gericht ohne gültige Rezept-ID' };
  }
  if (raw.servings === undefined) {
    return { ok: true, value: { recipeId: raw.recipeId, servings: DEFAULT_SERVINGS } };
  }
  if (!isServings(raw.servings)) {
    return { ok: false, error: `Portionen müssen zwischen 1 und ${MAX_SERVINGS} liegen` };
  }
  return { ok: true, value: { recipeId: raw.recipeId, servings: raw.servings } };
}

export function parseDishes(raw: unknown): ParseResult<DishInput[]> {
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'Gerichte müssen ein Array sein' };
  }
  if (raw.length > MAX_DISHES_PER_SLOT) {
    return { ok: false, error: `Höchstens ${MAX_DISHES_PER_SLOT} Gerichte pro Slot` };
  }

  const dishes: DishInput[] = [];
  for (const item of raw) {
    const parsed = parseDish(item);
    if (!parsed.ok) return parsed;
    dishes.push(parsed.value);
  }
  return { ok: true, value: dishes };
}

export interface SlotUpdate {
  target: SlotTarget;
  dishes: DishInput[];
}

const MAX_SLOTS_PER_UPDATE = 7 * MEAL_TYPES.length;

/**
 * Mehrere Slots in einem Aufruf ersetzen (z. B. Verschieben = Quelle und Ziel),
 * damit beide Änderungen in derselben Transaktion landen.
 */
export function parseSlotUpdates(raw: unknown): ParseResult<SlotUpdate[]> {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SLOTS_PER_UPDATE) {
    return { ok: false, error: `Slots müssen ein Array mit 1 bis ${MAX_SLOTS_PER_UPDATE} Einträgen sein` };
  }

  const seen = new Set<string>();
  const updates: SlotUpdate[] = [];
  for (const item of raw) {
    const target = parseSlotTarget(item);
    if (!target.ok) return target;
    const key = `${target.value.dayIndex}:${target.value.mealType}`;
    if (seen.has(key)) return { ok: false, error: 'Slot doppelt angegeben' };
    seen.add(key);

    const dishes = parseDishes((item as UnknownRecord).dishes);
    if (!dishes.ok) return dishes;
    updates.push({ target: target.value, dishes: dishes.value });
  }
  return { ok: true, value: updates };
}

/**
 * Alte Clients (Android-App) kennen nur ein Gericht pro Slot und sehen das
 * erste. Ihr Setzen/Leeren betrifft deshalb nur dieses erste Gericht; weitere
 * Gerichte (z. B. der Nachtisch) bleiben erhalten.
 */
export function applyLegacySlotUpdate(existing: DishInput[], dish: DishInput | null): DishInput[] {
  const rest = existing.slice(1);
  if (!dish) return rest;
  return [dish, ...rest.filter((other) => other.recipeId !== dish.recipeId)];
}

export function buildSlotRows(
  mealPlanId: string,
  target: SlotTarget,
  dishes: DishInput[],
  startPosition = 0
): MealSlotRow[] {
  return dishes.map((dish, index) => ({
    mealPlanId,
    dayIndex: target.dayIndex,
    mealType: target.mealType,
    position: startPosition + index,
    recipeId: dish.recipeId,
    servings: dish.servings
  }));
}

/**
 * Zeilen für das Speichern einer ganzen Woche (PUT /:weekStart). Bleibt
 * nachsichtig wie bisher: ungültige Einträge werden verworfen statt die
 * Anfrage abzulehnen; Positionen werden je Slot in Eingabereihenfolge vergeben.
 */
export function buildWeekRows(mealPlanId: string, meals: unknown[]): MealSlotRow[] {
  const nextPosition = new Map<string, number>();
  const rows: MealSlotRow[] = [];

  for (const meal of meals) {
    if (!isRecord(meal)) continue;
    const target = parseSlotTarget(meal);
    if (!target.ok || typeof meal.recipeId !== 'string' || meal.recipeId.length === 0) continue;

    const key = `${target.value.dayIndex}:${target.value.mealType}`;
    const position = nextPosition.get(key) ?? 0;
    if (position >= MAX_DISHES_PER_SLOT) continue;
    nextPosition.set(key, position + 1);

    rows.push({
      mealPlanId,
      ...target.value,
      position,
      recipeId: meal.recipeId,
      servings: isServings(meal.servings) ? meal.servings : DEFAULT_SERVINGS
    });
  }
  return rows;
}
