import { describe, expect, test } from 'vitest';
import { EMPTY_STATS, mergeRecipeStats, statsFor } from './recipe-stats';

describe('mergeRecipeStats', () => {
  test('übernimmt Kochzähler und letzten Kochzeitpunkt', () => {
    const stats = mergeRecipeStats(
      [{ recipeId: 'a', count: 7, lastCookedAt: new Date('2026-09-20T18:00:00.000Z') }],
      []
    );

    expect(stats.get('a')).toEqual({
      cookCount: 7,
      lastCookedAt: '2026-09-20T18:00:00.000Z',
      isFavorite: false
    });
  });

  test('markiert Favoriten auch ohne Kochhistorie', () => {
    const stats = mergeRecipeStats([], ['b']);

    expect(stats.get('b')).toEqual({ cookCount: 0, lastCookedAt: null, isFavorite: true });
  });

  test('verbindet Favorit und Kochzähler desselben Rezepts', () => {
    const stats = mergeRecipeStats(
      [{ recipeId: 'c', count: 2, lastCookedAt: new Date('2026-01-01T00:00:00.000Z') }],
      ['c']
    );

    expect(stats.get('c')).toEqual({
      cookCount: 2,
      lastCookedAt: '2026-01-01T00:00:00.000Z',
      isFavorite: true
    });
  });
});

describe('statsFor', () => {
  test('liefert leere Statistik für unbekannte Rezepte', () => {
    expect(statsFor(new Map(), 'unbekannt')).toBe(EMPTY_STATS);
  });
});
