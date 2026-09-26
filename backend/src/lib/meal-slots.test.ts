import { describe, expect, test } from 'vitest';
import {
  MAX_DISHES_PER_SLOT,
  applyLegacySlotUpdate,
  buildSlotRows,
  buildWeekRows,
  parseDish,
  parseDishes,
  parseSlotTarget,
  parseSlotUpdates
} from './meal-slots';

describe('parseSlotUpdates', () => {
  test('liest mehrere Slots in einem Aufruf (z. B. Verschieben)', () => {
    const result = parseSlotUpdates([
      { dayIndex: 0, mealType: 'dinner', dishes: [] },
      { dayIndex: 1, mealType: 'lunch', dishes: [{ recipeId: 'r1', servings: 3 }] }
    ]);

    expect(result).toEqual({
      ok: true,
      value: [
        { target: { dayIndex: 0, mealType: 'dinner' }, dishes: [] },
        { target: { dayIndex: 1, mealType: 'lunch' }, dishes: [{ recipeId: 'r1', servings: 3 }] }
      ]
    });
  });

  test('lehnt leere Liste, Nicht-Arrays und doppelte Slots ab', () => {
    expect(parseSlotUpdates([]).ok).toBe(false);
    expect(parseSlotUpdates('x').ok).toBe(false);
    expect(
      parseSlotUpdates([
        { dayIndex: 0, mealType: 'dinner', dishes: [] },
        { dayIndex: 0, mealType: 'dinner', dishes: [] }
      ]).ok
    ).toBe(false);
  });

  test('lehnt ab, wenn ein Slot ungültig ist', () => {
    expect(parseSlotUpdates([{ dayIndex: 0, mealType: 'dinner', dishes: [{ recipeId: '' }] }]).ok).toBe(false);
    expect(parseSlotUpdates([{ dayIndex: 9, mealType: 'dinner', dishes: [] }]).ok).toBe(false);
  });
});

describe('applyLegacySlotUpdate', () => {
  const main = { recipeId: 'main', servings: 4 };
  const dessert = { recipeId: 'dessert', servings: 2 };
  const soup = { recipeId: 'soup', servings: 3 };

  test('ersetzt nur das erste Gericht und behält den Nachtisch', () => {
    expect(applyLegacySlotUpdate([main, dessert], soup)).toEqual([soup, dessert]);
  });

  test('entfernt nur das erste Gericht, wenn kein Rezept übergeben wird', () => {
    expect(applyLegacySlotUpdate([main, dessert], null)).toEqual([dessert]);
  });

  test('legt in einem leeren Slot das Gericht an', () => {
    expect(applyLegacySlotUpdate([], soup)).toEqual([soup]);
    expect(applyLegacySlotUpdate([], null)).toEqual([]);
  });

  test('entfernt ein Duplikat des neuen Rezepts weiter hinten', () => {
    expect(applyLegacySlotUpdate([main, dessert], { recipeId: 'dessert', servings: 5 })).toEqual([
      { recipeId: 'dessert', servings: 5 }
    ]);
  });
});

describe('parseSlotTarget', () => {
  test('akzeptiert Tag 0–6 und die drei Mahlzeiten', () => {
    expect(parseSlotTarget({ dayIndex: 6, mealType: 'dinner' })).toEqual({
      ok: true,
      value: { dayIndex: 6, mealType: 'dinner' }
    });
  });

  test('lehnt Tag außerhalb der Woche ab', () => {
    expect(parseSlotTarget({ dayIndex: 7, mealType: 'lunch' }).ok).toBe(false);
    expect(parseSlotTarget({ dayIndex: -1, mealType: 'lunch' }).ok).toBe(false);
  });

  test('lehnt Kommazahlen, Strings und fehlende Werte ab', () => {
    expect(parseSlotTarget({ dayIndex: 1.5, mealType: 'lunch' }).ok).toBe(false);
    expect(parseSlotTarget({ dayIndex: '1', mealType: 'lunch' }).ok).toBe(false);
    expect(parseSlotTarget({ mealType: 'lunch' }).ok).toBe(false);
    expect(parseSlotTarget(null).ok).toBe(false);
  });

  test('lehnt unbekannte Mahlzeit ab', () => {
    expect(parseSlotTarget({ dayIndex: 0, mealType: 'snack' }).ok).toBe(false);
  });
});

describe('parseDish', () => {
  test('übernimmt Rezept und Portionen', () => {
    expect(parseDish({ recipeId: 'r1', servings: 4 })).toEqual({
      ok: true,
      value: { recipeId: 'r1', servings: 4 }
    });
  });

  test('setzt 2 Portionen, wenn keine angegeben sind', () => {
    expect(parseDish({ recipeId: 'r1' })).toEqual({ ok: true, value: { recipeId: 'r1', servings: 2 } });
  });

  test('lehnt fehlende Rezept-ID ab', () => {
    expect(parseDish({ servings: 2 }).ok).toBe(false);
    expect(parseDish({ recipeId: '', servings: 2 }).ok).toBe(false);
    expect(parseDish({ recipeId: 42 }).ok).toBe(false);
  });

  test('lehnt Portionen außerhalb 1–99 oder Kommazahlen ab', () => {
    expect(parseDish({ recipeId: 'r1', servings: 0 }).ok).toBe(false);
    expect(parseDish({ recipeId: 'r1', servings: 100 }).ok).toBe(false);
    expect(parseDish({ recipeId: 'r1', servings: 2.5 }).ok).toBe(false);
  });
});

describe('parseDishes', () => {
  test('akzeptiert eine leere Liste (Slot leeren)', () => {
    expect(parseDishes([])).toEqual({ ok: true, value: [] });
  });

  test('behält die Reihenfolge', () => {
    const result = parseDishes([{ recipeId: 'main', servings: 4 }, { recipeId: 'dessert', servings: 2 }]);
    expect(result).toEqual({
      ok: true,
      value: [
        { recipeId: 'main', servings: 4 },
        { recipeId: 'dessert', servings: 2 }
      ]
    });
  });

  test('lehnt Nicht-Arrays ab', () => {
    expect(parseDishes(undefined).ok).toBe(false);
    expect(parseDishes({ recipeId: 'r1' }).ok).toBe(false);
  });

  test('lehnt mehr als die erlaubte Anzahl Gerichte ab', () => {
    const tooMany = Array.from({ length: MAX_DISHES_PER_SLOT + 1 }, (_, i) => ({ recipeId: `r${i}` }));
    expect(parseDishes(tooMany).ok).toBe(false);
  });

  test('lehnt die ganze Liste ab, wenn ein Gericht ungültig ist', () => {
    expect(parseDishes([{ recipeId: 'r1' }, { recipeId: '' }]).ok).toBe(false);
  });
});

describe('buildSlotRows', () => {
  test('nummeriert die Gerichte in Reihenfolge durch', () => {
    const rows = buildSlotRows('plan', { dayIndex: 2, mealType: 'dinner' }, [
      { recipeId: 'main', servings: 4 },
      { recipeId: 'dessert', servings: 2 }
    ]);

    expect(rows).toEqual([
      { mealPlanId: 'plan', dayIndex: 2, mealType: 'dinner', position: 0, recipeId: 'main', servings: 4 },
      { mealPlanId: 'plan', dayIndex: 2, mealType: 'dinner', position: 1, recipeId: 'dessert', servings: 2 }
    ]);
  });

  test('beginnt bei einer vorgegebenen Startposition (Anhängen)', () => {
    const rows = buildSlotRows('plan', { dayIndex: 0, mealType: 'lunch' }, [{ recipeId: 'r', servings: 2 }], 3);
    expect(rows[0].position).toBe(3);
  });
});

describe('buildWeekRows', () => {
  test('nummeriert je Slot getrennt und verwirft ungültige Einträge wie bisher', () => {
    const rows = buildWeekRows('plan', [
      { dayIndex: 0, mealType: 'dinner', recipeId: 'a', servings: 2 },
      { dayIndex: 1, mealType: 'dinner', recipeId: 'b' },
      { dayIndex: 0, mealType: 'dinner', recipeId: 'c', servings: 3 },
      { dayIndex: 0, mealType: 'dinner', recipeId: null },
      { dayIndex: 9, mealType: 'dinner', recipeId: 'x' }
    ]);

    expect(rows).toEqual([
      { mealPlanId: 'plan', dayIndex: 0, mealType: 'dinner', position: 0, recipeId: 'a', servings: 2 },
      { mealPlanId: 'plan', dayIndex: 1, mealType: 'dinner', position: 0, recipeId: 'b', servings: 2 },
      { mealPlanId: 'plan', dayIndex: 0, mealType: 'dinner', position: 1, recipeId: 'c', servings: 3 }
    ]);
  });

  test('kappt einen Slot bei der Höchstzahl Gerichte', () => {
    const meals = Array.from({ length: MAX_DISHES_PER_SLOT + 2 }, (_, i) => ({
      dayIndex: 3,
      mealType: 'lunch',
      recipeId: `r${i}`
    }));

    expect(buildWeekRows('plan', meals)).toHaveLength(MAX_DISHES_PER_SLOT);
  });

  test('ignoriert Einträge, die keine Objekte sind', () => {
    expect(buildWeekRows('plan', [null, 'x', 3])).toEqual([]);
  });
});
