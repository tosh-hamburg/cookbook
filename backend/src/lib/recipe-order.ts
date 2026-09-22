import type { Prisma } from '@prisma/client';

/**
 * Sortierung der Rezeptliste für GET /recipes.
 *
 * `createdAt` allein reicht nicht: Die Spalte ist TIMESTAMP(3) mit
 * DEFAULT CURRENT_TIMESTAMP, und CURRENT_TIMESTAMP ist in PostgreSQL die
 * Startzeit der Transaktion — alle Rezepte eines Batch-Imports tragen
 * denselben Wert. Bei Gleichstand darf die Datenbank die Reihenfolge pro
 * Abfrage frei wählen. Über die Seitengrenzen von OFFSET/LIMIT hinweg
 * erscheint derselbe Treffer dann auf zwei Seiten, während ein anderer ganz
 * herausfällt (Android-App). Clients ohne Paginierung (Web-App, `full=true`)
 * holen alles in einer Abfrage und merken davon nichts.
 *
 * Die `id` als zweiter Schlüssel macht die Sortierung eindeutig und die
 * Paginierung damit stabil.
 */
export const RECIPE_LIST_ORDER: Prisma.RecipeOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'desc' },
];
