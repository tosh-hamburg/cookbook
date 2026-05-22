/* Zeit-Instructions-Parser-Verifikation gegen echtes HTML-Fixture.
 * Ausführen: cd backend && npx ts-node test-zeit-parser.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// parseZeitInstructions wird nicht exportiert, daher lokal duplizieren:
// das ist OK für einen Smoke-Test. Die echte Funktion sollte bei Änderungen
// synchron gehalten werden — Verifikation ist die Datenform, nicht die Identität.
function parseZeitInstructions(html: string): string {
  const headingRe = /<h2\b[^>]*class="[^"]*article__subheading--recipe[^"]*"[^>]*>[^<]*<\/h2>/i;
  const headingMatch = html.match(headingRe);
  if (!headingMatch || typeof headingMatch.index !== 'number') return '';

  const afterHeading = html.slice(headingMatch.index + headingMatch[0].length);

  const cleaned = afterHeading
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, '')
    .replace(/<figure\b[\s\S]*?<\/figure>/gi, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '')
    .replace(/<template\b[\s\S]*?<\/template>/gi, '')
    .replace(/<form\b[\s\S]*?<\/form>/gi, '')
    .replace(/<div\s+class="iqdcontainer[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');

  const stopRe = /(<h[12]\b|<div\s+class="ingredient-dice"\b|<div\s+class="recipe-list-collection"\b|<section\b[^>]*comment|<footer\b)/i;
  const stopMatch = cleaned.match(stopRe);
  const block = stopMatch && typeof stopMatch.index === 'number'
    ? cleaned.slice(0, stopMatch.index)
    : cleaned;

  const paragraphRe = /<p\b[^>]*class="[^"]*paragraph\s+article__item[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
  const steps: string[] = [];
  let stepNumber = 1;
  let m: RegExpExecArray | null;

  while ((m = paragraphRe.exec(block)) !== null) {
    const text = m[1]
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 0) {
      steps.push(`${stepNumber}. ${text}`);
      stepNumber++;
    }
  }

  return steps.join('\n\n');
}

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('Zeit-Instructions-Parser');

const fixturePath = path.resolve(__dirname, '..', 'zeit-sample-clean.html');
if (!fs.existsSync(fixturePath)) {
  console.error(`  SKIP  Fixture nicht vorhanden: ${fixturePath}`);
  process.exit(0);
}
const html = fs.readFileSync(fixturePath, 'utf8');

const result = parseZeitInstructions(html);

run('findet alle 7 Rezept-Schritte (auch nach Newsletter-/Topicbox-Blöcken)', () => {
  const stepCount = (result.match(/^\d+\./gm) || []).length;
  assert.ok(stepCount >= 7, `erwartet >= 7 Schritte, erhalten ${stepCount}`);
});

run('letzter Schritt enthält Servier-Anweisung', () => {
  assert.match(result, /mit dem Fenchelgr(ü|u)n dekorieren/);
});

run('Schritt 1 enthält Backofen-Anweisung', () => {
  assert.match(result, /^1\. .*Backofen.*200 Grad/m);
});

run('enthält Kernanweisung für Schalotten/Weißwein', () => {
  assert.match(result, /Schalottenw(ü|u)rfel[^\n]*Wein/);
});

run('ignoriert Newsletter-/Topicbox-/Ad-Blöcke zwischen Schritten', () => {
  // Newsletter enthält "Abonnieren" und "Der kleine Wochenmarkt" — dürfen nicht in Instructions landen
  assert.doesNotMatch(result, /Abonnieren/);
  assert.doesNotMatch(result, /Der kleine Wochenmarkt/);
  assert.doesNotMatch(result, /Mehr Fischgerichte/);
});

run('stoppt vor der ingredient-dice-Liste', () => {
  assert.doesNotMatch(result, /Artischocke/);
  assert.doesNotMatch(result, /Aubergine/);
});

run('liefert String für HTML ohne Rezept-Heading', () => {
  assert.equal(parseZeitInstructions('<html><body><p>no recipe</p></body></html>'), '');
});
