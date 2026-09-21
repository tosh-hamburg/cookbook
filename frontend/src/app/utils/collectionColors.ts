/**
 * Sammlungsfarben (Badge-Text, Punkte) aus dem Handoff. Unbekannte Sammlungen
 * bekommen einen aus dem Namen gehashten Farbton bei gleicher Helligkeit/Chroma.
 */
const NAMED_HUES: Record<string, string> = {
  'aufläufe': 'oklch(0.66 0.15 60)',
  'fleisch': 'oklch(0.60 0.17 25)',
  'nudeln': 'oklch(0.66 0.14 85)',
  'leicht': 'oklch(0.60 0.12 150)',
  'suppen': 'oklch(0.62 0.13 40)',
  'fisch': 'oklch(0.62 0.10 210)',
  'wok': 'oklch(0.58 0.14 320)',
};

export const NEUTRAL_HUE = 'oklch(0.72 0.02 60)';

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function collectionColor(name: string | undefined | null): string {
  if (!name) return NEUTRAL_HUE;
  const known = NAMED_HUES[name.trim().toLowerCase()];
  if (known) return known;

  const hash = hashString(name.trim().toLowerCase());
  const hue = hash % 360;
  const lightness = 0.6 + (hash % 7) / 100; // 0.60–0.66
  const chroma = 0.1 + (hash % 8) / 100; // 0.10–0.17
  return `oklch(${lightness.toFixed(2)} ${chroma.toFixed(2)} ${hue})`;
}
