/**
 * Mengenrechnung für Zutaten (Handoff 3a): führende Zahl parsen, mit dem
 * Portionsfaktor multiplizieren, auf 2 Dezimalstellen runden, Komma als
 * Dezimaltrennzeichen. Alles ohne führende Zahl („nach Gefühl") bleibt unverändert.
 */

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 0.25,
  '¾': 0.75,
  '⅛': 0.125,
};

export interface ParsedAmount {
  value: number | null;
  rest: string;
}

/** Zerlegt „1 1/2 EL" in { value: 1.5, rest: 'EL' }; ohne Zahl → value null. */
export function parseAmount(amount: string): ParsedAmount {
  const text = (amount ?? '').trim();
  if (!text) return { value: null, rest: '' };

  // Ganzzahl + Bruch („1 1/2"), reiner Bruch („1/2"), Dezimal („1,5" / „1.5"), Unicode-Bruch („1½", „½")
  const match = text.match(
    /^(\d+(?:[.,]\d+)?)?\s*(?:(\d+)\s*\/\s*(\d+)|([½⅓⅔¼¾⅛]))?\s*(.*)$/s,
  );
  if (!match) return { value: null, rest: text };

  const [, whole, numerator, denominator, unicodeFraction, rest] = match;
  if (whole === undefined && numerator === undefined && unicodeFraction === undefined) {
    return { value: null, rest: text };
  }

  const base = whole !== undefined ? parseFloat(whole.replace(',', '.')) : 0;
  const fraction =
    numerator !== undefined && denominator !== undefined && parseInt(denominator, 10) !== 0
      ? parseInt(numerator, 10) / parseInt(denominator, 10)
      : unicodeFraction
        ? UNICODE_FRACTIONS[unicodeFraction]
        : 0;

  return { value: base + fraction, rest: (rest ?? '').trim() };
}

/** Rundet auf 2 Dezimalstellen und schreibt das Komma („0,75"). */
export function formatAmountNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace('.', ',');
}

export function scaleAmount(amount: string, factor: number): string {
  const parsed = parseAmount(amount);
  if (parsed.value === null) return amount;
  if (factor === 1) return amount;
  const scaled = formatAmountNumber(parsed.value * factor);
  return parsed.rest ? `${scaled} ${parsed.rest}` : scaled;
}
