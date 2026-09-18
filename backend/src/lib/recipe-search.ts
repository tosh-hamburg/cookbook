import { PrismaClient } from '@prisma/client';

/** Längste akzeptierte Sucheingabe (Zeichen). */
export const MAX_SEARCH_LENGTH = 200;

// Textsuchkonfiguration von PostgreSQL; muss zur Migration
// add_recipe_fulltext_search passen, die "Recipe"."searchVector" befüllt.
const TEXT_SEARCH_CONFIG = 'german';

// Ein Suchwort besteht nur aus Buchstaben und Ziffern. Alles andere
// (Satzzeichen, tsquery-Operatoren wie & | ! : *) wird verworfen.
const SEARCH_WORD = /[\p{L}\p{N}]+/gu;

/**
 * Prüft eine rohe Sucheingabe (z. B. aus req.query).
 * - fehlend oder leer: '' (keine Suche)
 * - gültig: bereinigter Suchtext
 * - ungültig (kein String, zu lang): null
 */
export function normalizeSearchTerm(raw: unknown): string | null {
  if (raw === undefined) {
    return '';
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > MAX_SEARCH_LENGTH ? null : trimmed;
}

/**
 * Baut aus der Sucheingabe einen tsquery-Ausdruck: jedes Wort als
 * Präfixsuche, alle Wörter müssen vorkommen ("Toma Sup" findet "Tomatensuppe"
 * ebenso wie "Tomaten" + "Suppe" in Titel/Zutaten/Anleitung).
 * Die Stammformreduktion übernimmt to_tsquery() in der Datenbank.
 */
export function buildFullTextQuery(search: string): string | null {
  const words = search.match(SEARCH_WORD) ?? [];
  if (words.length === 0) {
    return null;
  }
  return words.map((word) => `${word}:*`).join(' & ');
}

/**
 * Liefert die IDs aller Rezepte, die zur Eingabe passen — beste Treffer zuerst.
 *
 * Volltext: Suchvektor aus Titel, Kategorien, Zutaten, Notizen und Anleitung
 * (Wortanfänge, Stammformen). Ergänzend eine Teilstringsuche in Titel und
 * Zutatennamen, weil der deutsche Parser zusammengesetzte Wörter nicht zerlegt
 * ("Suppe" soll "Tomatensuppe" finden) — das entspricht dem Verhalten der
 * früheren Titelsuche. Rein per Teilstring gefundene Rezepte stehen hinten.
 */
export async function findRecipeIdsByFullText(prisma: PrismaClient, search: string): Promise<string[]> {
  const query = buildFullTextQuery(search);
  if (query === null) {
    return [];
  }
  // strpos statt LIKE: keine Platzhalter, also nichts zu maskieren.
  const needle = search.toLowerCase();
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT r."id"
    FROM "Recipe" r
    WHERE r."searchVector" @@ to_tsquery(${TEXT_SEARCH_CONFIG}::regconfig, ${query})
       OR strpos(lower(r."title"), ${needle}) > 0
       OR EXISTS (
         SELECT 1 FROM "Ingredient" i
         WHERE i."recipeId" = r."id" AND strpos(lower(i."name"), ${needle}) > 0
       )
    ORDER BY ts_rank(r."searchVector", to_tsquery(${TEXT_SEARCH_CONFIG}::regconfig, ${query})) DESC,
             r."createdAt" DESC
  `;
  return rows.map((row) => row.id);
}
