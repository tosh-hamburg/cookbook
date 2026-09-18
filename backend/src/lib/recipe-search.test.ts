import { describe, expect, test } from 'vitest';
import { buildFullTextQuery, MAX_SEARCH_LENGTH, normalizeSearchTerm } from './recipe-search';

describe('buildFullTextQuery', () => {
  test('macht aus jedem Wort eine Präfixsuche und verknüpft mit UND', () => {
    expect(buildFullTextQuery('Tomaten Suppe')).toBe('Tomaten:* & Suppe:*');
  });

  test('ignoriert Satzzeichen und tsquery-Operatoren', () => {
    expect(buildFullTextQuery("Süß-Sauer & (Huhn) | 'Reis':* !Nudeln")).toBe(
      'Süß:* & Sauer:* & Huhn:* & Reis:* & Nudeln:*'
    );
  });

  test('behält Umlaute, ß und Ziffern', () => {
    expect(buildFullTextQuery('Käse 500g')).toBe('Käse:* & 500g:*');
  });

  test('liefert null, wenn kein Suchwort übrig bleibt', () => {
    expect(buildFullTextQuery('   ')).toBeNull();
    expect(buildFullTextQuery('&&& ---')).toBeNull();
    expect(buildFullTextQuery('')).toBeNull();
  });
});

describe('normalizeSearchTerm', () => {
  test('entfernt Leerraum an den Rändern', () => {
    expect(normalizeSearchTerm('  Suppe  ')).toBe('Suppe');
  });

  test('fehlende oder leere Eingabe bedeutet: keine Suche', () => {
    expect(normalizeSearchTerm(undefined)).toBe('');
    expect(normalizeSearchTerm('')).toBe('');
    expect(normalizeSearchTerm('   ')).toBe('');
  });

  test('lehnt Nicht-Strings ab', () => {
    expect(normalizeSearchTerm(['a'])).toBeNull();
    expect(normalizeSearchTerm(42)).toBeNull();
  });

  test('lehnt überlange Eingaben ab', () => {
    expect(normalizeSearchTerm('a'.repeat(MAX_SEARCH_LENGTH))).toHaveLength(MAX_SEARCH_LENGTH);
    expect(normalizeSearchTerm('a'.repeat(MAX_SEARCH_LENGTH + 1))).toBeNull();
  });
});
