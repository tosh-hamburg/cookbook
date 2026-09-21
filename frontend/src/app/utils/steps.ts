/**
 * Zerlegt den Anleitungstext eines Rezepts in Schritte (Handoff 3a/3b).
 * `instructions` ist heute ein Textblock — getrennt wird an Leerzeilen oder an
 * Nummerierungen („1.", „2)", „Schritt 3:"). Eine kurze erste Zeile ohne
 * Satzende wird als Überschrift des Schritts verwendet; eine Zeitangabe im
 * Text („25 Minuten") wird als Vorschlag für den Timer übernommen.
 */

export interface RecipeStep {
  index: number;
  title: string | null;
  text: string;
  minutes: number | null;
}

const NUMBERING = /^\s*(?:schritt\s*)?(\d{1,2})\s*[.):]\s*/i;
const MAX_TITLE_LENGTH = 60;

function splitIntoBlocks(instructions: string): string[] {
  const normalized = instructions.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const numberedLines = lines.filter((line) => NUMBERING.test(line)).length;

  // Nummerierte Zeilen sind das stärkere Signal, sobald es mindestens zwei gibt.
  if (numberedLines >= 2) {
    return lines
      .reduce<string[]>((blocks, line) => {
        if (NUMBERING.test(line) || blocks.length === 0) {
          return [...blocks, line.replace(NUMBERING, '')];
        }
        return [...blocks.slice(0, -1), `${blocks[blocks.length - 1]}\n${line}`];
      }, [])
      .map((block) => block.trim())
      .filter(Boolean);
  }

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;

  // Ein einziger Absatz mit mehreren Zeilen: jede Zeile ein Schritt
  const singleLines = lines.map((line) => line.trim()).filter(Boolean);
  return singleLines.length > 1 ? singleLines : paragraphs;
}

function extractMinutes(text: string): number | null {
  const match = text.match(/(\d{1,3})\s*(?:min(?:uten|\.)?|minutes?)\b/i);
  return match ? parseInt(match[1], 10) : null;
}

function splitTitle(block: string): { title: string | null; text: string } {
  const [firstLine, ...rest] = block.split('\n');
  const candidate = firstLine.trim().replace(/[:：]$/, '');
  const looksLikeTitle =
    rest.length > 0 &&
    candidate.length > 0 &&
    candidate.length <= MAX_TITLE_LENGTH &&
    !/[.!?]$/.test(candidate);

  if (looksLikeTitle) {
    return { title: candidate, text: rest.join('\n').trim() };
  }
  return { title: null, text: block.trim() };
}

export function parseSteps(instructions: string): RecipeStep[] {
  return splitIntoBlocks(instructions).map((block, index) => {
    const { title, text } = splitTitle(block);
    return {
      index,
      title,
      text,
      minutes: extractMinutes(text) ?? (title ? extractMinutes(title) : null),
    };
  });
}

export function formatStepNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}
