# Handoff: Cookbook „Küchentisch" (Konzept 2a + Flow 3a–3c)

## Überblick
Redesign der Cookbook-App für **Privatnutzer** — vier Screens: Rezeptbibliothek (2a),
Rezeptdetail (3a), Kochmodus (3b), Wochenplaner (3c). Grundlage ist ein warmes
Magazin-Layout mit Serif-Titeln, einem großen „Rezept der Woche", gefilterter Rezeptsammlung
und einem Wochenplan-Band am Fuß der Seite. Ziel ist Appetit und Entscheidungshilfe statt
Datenverwaltung — das alte Layout (Foto-Header + drei gestapelte Filterzeilen + karge Karten)
wird ersetzt.

Zielrepo: `tosh-hamburg/cookbook`, Branch `main`, betroffen ist `frontend/` (React 19 + Vite +
Tailwind + shadcn/ui-Komponenten unter `frontend/src/app/components/ui/`).

## Zu den Design-Dateien
Die beigelegten Dateien sind **Design-Referenzen in HTML** — ein Prototyp, der Aussehen und
Verhalten zeigt, **kein Produktionscode zum Kopieren**. Aufgabe ist, das Design im bestehenden
Frontend nachzubauen: React-Komponenten in `frontend/src/app/components/`, Styling über Tailwind
und `frontend/src/styles/theme.css`, Icons über `lucide-react` (bereits im Projekt), Daten über
`frontend/src/app/services/api.ts` und die Typen aus `frontend/src/app/types/recipe.ts`.
Der Prototyp nutzt ein eigenes Streaming-Format (`support.js`, `.dc.html`) — das ist nur
Vorschau-Infrastruktur und wird **nicht** übernommen.

## Fidelity
**High-fidelity.** Farben, Typografie, Abstände, Radien und Hover-Zustände sind final und unten
exakt dokumentiert. Bitte pixelgenau nachbauen, aber mit den vorhandenen UI-Primitives des
Repos (`ui/button`, `ui/input`, `ui/badge`, `ui/card`) — deren Varianten ggf. um die hier
genannten Tokens erweitern statt neue Einzelstile zu streuen.

Im Prototyp liegen zwei Runden: **umzusetzen sind `id="2a"` (Bibliothek) sowie `id="3a"`,
`id="3b"`, `id="3c"` (Detail, Kochmodus, Wochenplaner)**. Die Abschnitte `2b` und `2c` sind
verworfene Alternativrichtungen und liegen nur als Kontext bei — nicht umsetzen.

---

## Screens / Views

### 1. Rezeptbibliothek (`RecipeList`) — der einzige neue Screen
**Zweck:** Rezept finden, sich inspirieren lassen, direkt auf einen Wochentag legen.

**Rahmen/Layout (Desktop, Designbreite 1340 px Innenbreite):**
- Seitenhintergrund: `--paper` (cremefarben), zusätzlich ein Punktraster:
  `background-image: radial-gradient(rgba(...,.09) 1px, transparent 1px); background-size: 22px 22px;`
  (Punktfarbe = `oklch(0.62 0.05 50 / .09)`), `pointer-events: none`.
- **Header**, Höhe 78 px, `padding: 0 40px`, unten 1 px Hairline `--line`, Inhalt in einer Flex-Reihe
  mit `gap: 36px`:
  - Wortmarke „Kochbuch" — Instrument Serif 30px/1, `letter-spacing:-0.01em`, dahinter ein 7 px
    Punkt in `--tomato` (4 px Abstand).
  - Nav (Figtree 500 15px): „Rezepte" (aktiv: 2 px `border-bottom` in `--tomato`,
    `padding-bottom:6px`), „Wochenplan", „Einkaufszettel", „Vorratskammer" — inaktiv `--ink-3`,
    Hover `--ink`.
  - Spacer, dann Suchfeld: 280 px breit, Höhe 42 px, `border-radius: 999px`, 1 px `--line`,
    Hintergrund `#fff`, `padding: 0 16px 0 40px`, Placeholder „Wonach ist dir heute?",
    Lucide `search` 17 px in `oklch(0.6 0.04 50)` links bei 14 px, Fokus: Rahmen → `--tomato`.
  - Primäraktion „Rezept anlegen": Pill, Höhe 42 px, Hintergrund `--ink`, Text `#fff`
    (Figtree 600 14px), links ein 30 px Kreis in `--tomato` mit Lucide `plus` 16 px (weiß),
    `padding: 0 18px 0 6px`; Hover Hintergrund `oklch(0.2 0.04 45)`.
- **Inhaltsbereich**: `padding: 34px 40px 60px`, scrollt.

**Block A — Rezept der Woche** (`display:grid; grid-template-columns: 1.05fr .95fr; gap:40px;
align-items:center; margin-bottom:38px`), Einblendung `rise .5s ease both`:
- Kicker: 26 px Strich + „REZEPT DER WOCHE · AUTOMATISCH: 7× GEKOCHT" (Figtree 700 11.5px,
  `letter-spacing:.14em`, uppercase, `--tomato`), `gap: 8px`. Der Zusatz nennt den Grund der
  automatischen Auswahl; Zählwert aus der Kochhistorie.
- Titel: Instrument Serif 400 **52px/1.05**, `letter-spacing:-0.015em`, `text-wrap: balance`,
  `margin-top:16px`. Beispieltext: „Süßkartoffel-Auflauf mit Feta und Kreuzkümmel".
- Fließtext: Figtree 16.5px/1.6, `--ink-2`, `max-width:520px`, `text-wrap: pretty`.
- Drei Metriken in einer Reihe (`gap:26px`), je: Wert JetBrains Mono 700 26px/1
  (`letter-spacing:-0.03em`), darunter Label Figtree 600 11.5px uppercase `letter-spacing:.1em`
  in `--ink-4`. Inhalte: „55 Min / Gesamt", „4 / Portionen", „725 / kcal / Portion".
- Buttons (`gap:12px`, `margin-top:30px`), beide Höhe 50 px, `border-radius:999px`,
  Figtree 600 15.5px, Icon 18 px links:
  - Primär „Jetzt kochen": `--tomato`, Text weiß, `padding:0 24px`,
    `box-shadow: 0 10px 24px -12px oklch(0.56 0.17 32 / .8)`, Hover `oklch(0.48 0.17 32)`,
    Icon Lucide `utensils`/`chef-hat`.
  - Sekundär „Auf Mittwoch legen": 1.5 px Rahmen `--ink`, transparent, `padding:0 22px`,
    Hover: Hintergrund `--ink`, Text weiß, Icon Lucide `calendar`.
- Bildseite: Wrapper `position:relative`.
  - Dahinterliegende Salbei-Fläche: `position:absolute; inset:18px -14px -18px 18px;
    border-radius:26px; background: oklch(0.86 0.09 110 / .5)` (= `--sage`, 50 %).
  - Foto: Höhe 380 px, `border-radius:26px`, `overflow:hidden`,
    `box-shadow: 0 26px 50px -24px oklch(0.4 0.05 50 / .6)`, `object-fit: cover`.
  - „Stempel"-Notiz: `position:absolute; bottom:-22px; left:-18px; transform: rotate(-6deg);`
    weiße Karte, `border-radius:16px`, `padding:12px 16px`,
    `box-shadow: 0 14px 30px -16px oklch(0.4 0.05 50 / .6)`; Zeile 1 „Schon **7×** gekocht"
    (Figtree 500 12.5px, Zahl in JetBrains Mono), Zeile 2 „Familienfavorit"
    (Instrument Serif 17px).

**Block B — Sammlungsleiste** (`padding:22px 0 20px`, oben 1 px `--line`):
- „Meine Sammlung" Instrument Serif 30px/1; daneben „**{n}** Rezepte" (Figtree 500 14px,
  `--ink-4`, Zahl JetBrains Mono); Spacer; rechts die Kategorie-Pills (`gap:8px`, `flex-wrap`).
- Pill: Höhe 34 px, `padding:0 15px`, `border-radius:999px`, Figtree 600 13.5px,
  1 px Rahmen `--line`, transparent, Text `--ink-2`; **aktiv**: Hintergrund + Rahmen `--ink`,
  Text `#fff`; Hover: Rahmen → `--tomato`; `transition: background .14s, border-color .14s`.
- Pill-Set: „Alles" + die Sammlungen des Nutzers (`collectionsApi.getAll()`).

**Block C — Rezeptraster**: `grid-template-columns: repeat(3, minmax(0,1fr)); gap:26px`.
Karte (`RecipeCard`):
- `background:#fff; border-radius:20px; overflow:hidden;
  box-shadow: 0 14px 34px -24px oklch(0.4 0.05 50 / .7);`
  Hover `transform: translateY(-3px)` + `box-shadow: 0 24px 44px -24px oklch(0.4 0.05 50 / .8)`,
  `transition: transform .16s ease, box-shadow .16s ease`.
- Einblendung: `animation: rise .5s ease both`, `animation-delay: i * 60ms` (gestaffelt).
- Foto 196 px hoch, `object-fit:cover`, Fallback-Fläche `oklch(0.92 0.02 80)`.
  - Sammlungs-Pill oben links (12/12): Höhe 28 px, weiß, `border-radius:999px`,
    Figtree 700 11.5px uppercase `letter-spacing:.06em`, Textfarbe = Sammlungsfarbe.
  - Herz oben rechts (10/10): 34 px Kreis, weiß, `box-shadow: 0 6px 14px -8px rgba(...)`,
    Lucide `heart` 17 px — gemerkt: `fill`+`stroke` = `--tomato`; sonst `fill:none`,
    `stroke: oklch(0.55 0.03 45)`.
- Textteil `padding:18px 20px 20px`:
  - Titel Instrument Serif 400 **23px/1.2**, `letter-spacing:-0.01em`, `min-height:55px`
    (2 Zeilen bündig), `text-wrap: pretty`.
  - Untertitel Figtree 14px/1.5 in `oklch(0.52 0.03 48)` — kurze Sachinfo, z. B.
    „Ofen 200 °C · hält zwei Abende" (im Repo: aus Notizen/Kategorien ableiten).
  - Fußzeile: `margin-top:16px; padding-top:14px; border-top: 1px dashed --line;`
    Figtree 500 13.5px `--ink-2`, `gap:18px`: Uhr-Icon (`clock`, 15 px, `--tomato`) +
    „**{totalTime}** Min"; Schüssel-Icon (15 px, `--herb`) + „**{servings}** Port."; Spacer;
    rechts „{caloriesPerUnit} kcal" in `--tomato`, Figtree 600 13px. Zahlen in JetBrains Mono.
  - **Wichtig:** keine Null-Nährwerte anzeigen. Ist `caloriesPerUnit` 0/leer, entfällt die
    kcal-Angabe (optional: dezenter Hinweis „Nährwerte offen").

**Block D — Wochenplan-Band** (`margin-top:34px`):
- Container `border-radius:22px; background:--ink; color:oklch(0.94 0.02 80); padding:26px 28px`.
- Kopf: „Deine Woche" Instrument Serif 26px weiß; daneben „KW 39 · noch 2 Abende offen"
  (Figtree 500 13.5px, `oklch(0.78 0.03 80)`); rechts Link „Einkaufszettel erzeugen →"
  (Figtree 600 13.5px, `--gold`).
- 7 Spalten (`repeat(7, minmax(0,1fr)); gap:10px`), Tile `border-radius:14px; padding:12px 13px;
  min-height:104px`:
  - belegt: Hintergrund `oklch(0.32 0.04 45)`, Tageskürzel `--gold` (Figtree 600 11.5px uppercase,
    `letter-spacing:.1em`), Gericht weiß Figtree 500 14px/1.35;
  - offen: transparent, 1 px **dashed** `oklch(0.44 0.03 50)`, Texte `oklch(0.72 0.03 60)`,
    Label „noch offen".

---

## Screen 2 — Rezeptdetail (3a)
**Zweck:** Rezept lesen, Mengen auf die eigene Portionszahl rechnen, einkaufen oder einplanen.

**Rahmen:** gleicher Papiergrund + Punktraster. Header 78 px: links „Zurück zur Sammlung"
(Lucide `arrow-left` 18 px, Figtree 600 14.5px, `--ink-2`, Hover `--ink`); rechts
„Quelle: {sourceUrl}" (Mono 12.5px), Trenner 1×24 px `--line`, dann zwei Pill-Buttons
(Höhe 38 px, weiß, 1 px `--line`, Hover Rahmen `--tomato`): „Bearbeiten" (`pencil`),
„Gemerkt" (`heart`, gefüllt in `--tomato`).

**Body:** `display:grid; grid-template-columns: 1fr 396px; gap:40px; align-items:start;
padding:34px 40px 60px`. Rechte Spalte `position:sticky; top:0`.

**Linke Spalte:**
- Badge-Zeile (`gap:10px`): Sammlungs-Pill (weiß, Text = Sammlungsfarbe, Figtree 700 11.5px
  uppercase `.08em`) + freie Tags (1 px `--line`, Figtree 500 12.5px, `oklch(0.45 0.03 48)`).
- Titel: Instrument Serif 400 **46px/1.08**, `letter-spacing:-0.015em`, `text-wrap:balance`.
- Titelfoto: Höhe 420 px, `border-radius:24px`, `object-fit:cover`,
  `box-shadow: 0 26px 50px -26px oklch(0.4 0.05 50 / .55)`, `margin-top:24px`.
- Metrik-Karte: weiß, `border-radius:18px`, `padding:20px 24px`, `gap:30px`,
  `box-shadow: 0 12px 30px -24px oklch(0.4 0.05 50 / .7)`. Vier Werte (Mono 700 24px/1) mit
  Labels (Figtree 600 11px uppercase `.1em`, `--ink-4`): Gesamt, Arbeitszeit, kcal/Portion,
  Gekocht (`7×`). Rechts der Primärbutton „Kochmodus" (Pill 46 px, `--tomato`, Lucide `play`).
- Notizblock: `background: oklch(0.86 0.09 110 / .38)`, 1 px `oklch(0.78 0.08 110 / .5)`,
  `border-radius:18px`, `padding:18px 22px`; Label „DEINE NOTIZ" (Figtree 700 11px uppercase
  `.12em`, `oklch(0.42 0.08 130)`), Text Figtree 15.5px/1.6. Inhalt = `recipe.notes`,
  inline editierbar.
- „Zubereitung": Instrument Serif 30px + Hairline. Schritte als Liste mit
  `grid-template-columns: 64px 1fr; gap:20px`, je `padding-bottom:18px` + 1 px dashed `--line`:
  - Ziffer Instrument Serif 40px in `oklch(0.78 0.06 45)` (zweistellig, `01`…),
  - Kopfzeile: Titel Figtree 600 16px + Teilzeit Mono 12.5px in `--tomato`,
  - Text Figtree 15.5px/1.65 `--ink-2`, `text-wrap:pretty`.
  Im Repo sind `instructions` heute ein Textblock — beim Speichern in Schritte splitten
  (Leerzeile/Nummerierung) oder Schritt-Array im Datenmodell ergänzen; Teilzeiten optional.

**Rechte Spalte — Zutatenkarte:** weiß, `border-radius:20px`, `padding:22px`,
`box-shadow: 0 16px 36px -26px oklch(0.4 0.05 50 / .8)`.
- Kopf: „Zutaten" Instrument Serif 26px; rechts Stepper: Pill-Rahmen 1 px `--line`,
  `border-radius:999px`, `padding:3px`, zwei 30 px Kreis-Buttons (`minus`/`plus` 15 px,
  Hover `oklch(0.94 0.02 80)`), Wert Mono 700 15px, `min-width:44px`, zentriert. Grenzen 1–12.
- Hinweis Figtree 13px/1.5 `oklch(0.58 0.03 55)`: „Portionen ändern rechnet die Mengen sofort um."
- Zeile: `grid-template-columns: 22px 1fr auto; gap:11px; padding:9px 2px`, unten 1 px
  `oklch(0.93 0.015 80)`; Checkbox 20 px, `border-radius:6px`, 1.5 px `oklch(0.8 0.02 80)`,
  abgehakt: Füllung `--tomato` + weißer `check` 13 px; Name Figtree 15px, Menge Mono 500 13.5px;
  abgehakt → `text-decoration: line-through`, Farbe `oklch(0.66 0.02 50)`. Ganze Zeile klickbar.
- **Mengenrechnung:** `Menge × (servings / recipe.servings)`, auf 2 Dezimalstellen runden,
  Dezimaltrennzeichen **Komma** (`0,75 Bund`). Mengen ohne Zahl („nach Gefühl") bleiben
  unverändert. kcal/Portion bleibt konstant. Im Repo ist `Ingredient.amount` ein String —
  beim Rechnen führende Zahl parsen, Rest als Einheit behalten; nicht parsebar → unverändert.
- Aktionen (`gap:9px`, Höhe 46 px, Pills): „Auf den Einkaufszettel" (1.5 px `--ink`, Hover
  invertiert, Lucide `shopping-cart`), „Auf einen Tag legen" (`--ink` gefüllt, weiß,
  Lucide `calendar` → öffnet `AddToWeekPlannerDialog` mit der aktuellen Portionszahl),
  darunter zentriert „{n} Zutaten abgehakt" (Figtree 13px, `oklch(0.6 0.03 55)`).

---

## Screen 3 — Kochmodus (3b)
**Zweck:** am Herd kochen — ein Schritt pro Ansicht, aus zwei Metern lesbar.

**Rahmen:** dunkel, `background: oklch(0.22 0.035 45)`, Text `oklch(0.94 0.02 80)`,
`border-radius:22px`, Höhe im Prototyp 820 px (in der App Vollbild). Zwei Spalten.

**Linke Spalte, 300 px, `background: oklch(0.18 0.03 45)`, `padding:28px 22px`:**
- Rezepttitel Instrument Serif 24px/1.15 weiß; Unterzeile „{servings} Portionen · {n} Schritte"
  (Figtree 500 13px, `oklch(0.72 0.04 80)`).
- Schritt-Rail (`gap:4px`): Zeile `grid-template-columns: 22px 1fr; padding:11px 12px;
  border-radius:12px`; Punkt 9 px — erledigt `--gold`, aktuell `--tomato`, offen
  `oklch(0.42 0.03 50)`; Label Figtree 600 14px; aktiv: Hintergrund `oklch(0.36 0.05 45)`,
  Text weiß; erledigt `oklch(0.72 0.05 90)`; offen `oklch(0.6 0.03 60)`; Hover
  `oklch(0.26 0.04 45)`. Klick springt zum Schritt.
- Fuß (oben 1 px `oklch(0.3 0.03 50)`): „ZUTATEN FÜR DIESEN DURCHGANG" (Figtree 700 10.5px
  uppercase `.12em`, `oklch(0.68 0.04 80)`), darunter Name/Menge-Zeilen (Figtree 14px /
  Mono 13px in `--gold`) — mit der Portionszahl gerechnet.

**Rechte Spalte, `padding:34px 44px 30px`:**
- Kopfzeile: „SCHRITT 03 VON 05" (Figtree 700 12px uppercase `.16em`, `--gold`), Fortschritts-
  balken (4 px, `border-radius:999px`, Spur `oklch(0.3 0.03 50)`, Füllung `--gold`,
  `transition: width .2s ease`), rechts „Bildschirm bleibt an" (Figtree 500 13px,
  `oklch(0.74 0.03 80)`, Lucide `sun`) — technisch **Wake Lock API**
  (`navigator.wakeLock.request('screen')`), Fallback: Hinweis ausblenden.
- Mitte (vertikal zentriert): Schrittname Instrument Serif 30px in `--gold`; Schritttext
  **Figtree 500 34px/1.4** weiß, `max-width:780px`, `text-wrap:pretty`.
- Fußzeile: Timer-Block (`background: oklch(0.18 0.03 45)`, `border-radius:18px`,
  `padding:16px 22px`): Zeit **Mono 700 44px** (`letter-spacing:-0.04em`, Format `MM:SS`,
  vorbelegt mit der Schrittzeit), daneben „Timer starten" (Pill 32 px, `--gold`, Text
  `oklch(0.24 0.04 60)`, Figtree 700 12.5px) + „Klingelt auch im Hintergrund" (11.5px).
  Läuft der Timer, zählt er sekündlich runter; bei 0 Signalton + Pulsieren des Blocks.
- Navigation rechts: „Zurück" (Höhe 60 px, Pill, 1.5 px `oklch(0.44 0.04 50)`, Hover Rahmen
  `--gold`) und „Weiter" (Höhe 60 px, `--tomato`, weiß, Figtree 600 17px,
  `box-shadow: 0 14px 30px -16px oklch(0.56 0.17 32)`). Grenzen: erster/letzter Schritt
  deaktiviert; letzter Schritt → „Fertig" (schließt Kochmodus, Kochzähler +1).
- Tastatur: ←/→ blättern, Leertaste startet/pausiert den Timer, Esc verlässt den Modus.

---

## Screen 4 — Wochenplaner (3c)
**Zweck:** Woche belegen und daraus den Einkaufszettel erzeugen.

**Rahmen:** Papiergrund + Punktraster, Header 78 px:
„Wochenplan" (Instrument Serif 30px) · Wochen-Navigation (zwei 34 px Kreis-Buttons, weiß,
1 px `--line`, Hover `--tomato`; dazwischen „KW 39" Mono 600 15px) · Datumsspanne
„22.–28. September" (Figtree 500 14px, `--ink-4`) · rechts Statushinweis (Figtree 500 13.5px,
`oklch(0.5 0.03 48)`: „Leeren Slot antippen, dann Rezept wählen" bzw. „Slot gewählt — Rezept
aus der Liste übernehmen") · Primärbutton „Einkaufszettel erzeugen" (Pill 42 px, `--ink`, weiß,
Lucide `shopping-cart`).

**Raster (links, scrollt, `padding:26px 30px 40px`):**
- Kopfzeile: `grid-template-columns: 96px repeat(7, minmax(0,1fr)); gap:10px`; je Tag
  Kürzel (Figtree 600 12px uppercase `.12em`, `--ink-4`) + Datum (Mono 500 13px, `--ink-2`).
- Drei Zeilen „Frühstück / Mittag / Abend" (Label Figtree 600 13px `--ink-2`, 96 px Spalte),
  je 7 Zellen, `min-height:118px`, `border-radius:16px`, `padding:12px 13px`,
  Hover `translateY(-2px)`:
  - **belegt:** weiß, 1.5 px `oklch(0.92 0.015 80)`,
    `box-shadow: 0 12px 26px -22px oklch(0.4 0.05 50 / .8)`; oben Punkt 8 px + Sammlungsname
    (Figtree 700 10px uppercase `.1em`) in Sammlungsfarbe; Titel **Instrument Serif 17px/1.25**;
    unten Zeit Mono 500 12px `oklch(0.58 0.03 55)`.
  - **leer:** transparent, 1.5 px **dashed** `oklch(0.85 0.02 80)`, Titel „frei" (Figtree 500
    14px, `oklch(0.58 0.03 55)`), Zeile „Rezept wählen"; **angetippt**: Hintergrund
    `oklch(0.94 0.045 85)`, Rahmen `--tomato`.
- Verhalten: leeren Slot antippen → `selectedSlot`; danach Klick auf einen Vorschlag (oder
  Drag & Drop einer Rezeptkarte) füllt den Slot. Belegte Zelle: Klick öffnet das Rezept,
  Kontextmenü/× entfernt es. Ideal zusätzlich Drag & Drop zwischen Slots.

**Rechte Spalte, 330 px, weiß, 1 px `--line` links, `padding:24px 24px 36px`:**
- „Vorschläge" (Instrument Serif 24px) + Satz „Nach Kochhäufigkeit und offenen Zutaten im
  Vorrat." (Figtree 13px/1.5, `oklch(0.56 0.03 55)`).
- Vorschlagszeile: `grid-template-columns: 8px 1fr auto; gap:11px; padding:12px 13px;
  border-radius:14px`, 1 px `oklch(0.9 0.015 80)`, Hover Rahmen `--tomato`; Punkt in
  Sammlungsfarbe, Titel Figtree 500 14px, darunter Sammlung (Figtree 500 11.5px uppercase
  `.06em`, Sammlungsfarbe), rechts Zeit Mono 12px.
- Einkaufszettel-Karte: `background:--ink`, `border-radius:18px`, `padding:18px`;
  Label „EINKAUFSZETTEL" (Figtree 700 10.5px uppercase `.14em`, `--gold`); „**18** Positionen"
  (Instrument Serif 26px weiß, Zahl Mono 24px); Satz Figtree 14px/1.55 `oklch(0.84 0.03 80)`;
  Button „Zettel öffnen" (Pill 44 px, `--gold`, Text `oklch(0.24 0.04 60)`, Figtree 700 14px).
  Aggregation wie `AggregatedIngredient` in `types/mealplan.ts`: gleiche Zutat zusammenfassen,
  Herkunftsrezepte behalten.

---

## Interaktionen & Verhalten
- **Suche** (Header): filtert `onInput` (debounce 200 ms empfohlen) über Titel, Untertitel und
  Zutatennamen; serverseitige Volltextsuche via `useRecipeSearch` bleibt bestehen.
- **Kategorie-/Sammlungs-Pills**: **Mehrfachauswahl** (OR-Logik, wie bisher im Repo). Jede Pill
  togglet; „Alles" leert die Auswahl und ist aktiv, solange nichts gewählt ist. Trefferzahl in der
  Sammlungs-Zeile aktualisiert sich sofort.
- **Herz**: optimistischer Toggle, persistiert pro Rezept (Favoritenfeld bzw. `localStorage`,
  solange kein Backend-Feld existiert).
- **Karte klicken** → Rezeptdetail (`onSelectRecipe`). Herz und Pills müssen `stopPropagation`
  machen.
- **„Auf Mittwoch legen" / „Jetzt kochen"**: öffnet `AddToWeekPlannerDialog` bzw. Kochansicht.
- **Animationen**: `@keyframes rise { from { opacity:0; transform: translateY(14px) } to
  { opacity:1; transform:none } }`; Hero `.5s`, Karten `.5s` mit 60 ms Staffelung;
  Hover-Transitions 140–160 ms. Alles in `@media (prefers-reduced-motion: reduce)` abschalten.
- **Leerzustand**: Instrument Serif 30px „Noch kein Treffer" + Satz in `--ink-2` +
  Primärbutton „Rezept anlegen" (gleiche Pill-Optik).
- **Responsive**: Raster 3 → 2 (unter ~1100 px) → 1 (unter ~700 px); Hero wird einspaltig,
  Foto zuerst; Wochenplan-Band scrollt horizontal.

## State
| State | Typ | Auslöser |
| --- | --- | --- |
| `query` | string | Sucheingabe |
| `collection` | string (`'Alle'` \| Sammlungsname) | Pill-Klick |
| `favorites` | Set/Record<recipeId, boolean> | Herz-Klick |
| `recipes`, `collections`, `categories` | API | Mount (`recipesApi`, `collectionsApi`, `categoriesApi`) |
| `weekPlan` | WeekPlan | Mount, für das Band (`types/mealplan.ts`) |
| `featured` | Recipe | „Rezept der Woche": **automatisch** = Rezept mit der höchsten Kochhäufigkeit (Tie-Break: zuletzt gekocht, dann neuestes). Kein manuelles Markieren. |
| `servings` | number | ± im Detail (3a), 1–12, Start = `recipe.servings` |
| `checkedIngredients` | Record<number, boolean> | Zutat abgehakt (3a), nur Sitzungsdauer |
| `step` | number | aktueller Schritt im Kochmodus (3b) |
| `selectedSlot` | `${day}${mealIndex}` \| '' | angetippter leerer Slot im Planer (3c) |

## Design Tokens
```css
--paper:      oklch(0.968 0.018 85);  /* ≈ #F6F1E7  Seitengrund */
--paper-edge: #E9E2D6;                /* Grund hinter dem Screen */
--card:       #FFFFFF;
--ink:        oklch(0.26 0.04 45);    /* ≈ #3A2A22  Titel, dunkles Band */
--ink-2:      oklch(0.42 0.03 45);    /* ≈ #6B564C  Fließtext */
--ink-3:      oklch(0.48 0.03 45);    /* ≈ #7A6357  Nav inaktiv */
--ink-4:      oklch(0.56 0.03 50);    /* ≈ #8E7666  Labels */
--line:       oklch(0.86 0.02 80);    /* ≈ #DCD4C6  Hairlines */
--tomato:     oklch(0.56 0.17 32);    /* ≈ #C8522F  Akzent */
--tomato-str: oklch(0.48 0.17 32);    /* ≈ #A94123  Hover */
--herb:       oklch(0.52 0.09 145);   /* ≈ #4E7A56 */
--sage:       oklch(0.86 0.09 110);   /* ≈ #D6DCA8  (50 % hinter dem Hero-Foto) */
--gold:       oklch(0.82 0.12 90);    /* ≈ #D9AE55  Link im dunklen Band */
--dot:        oklch(0.62 0.05 50 / .09);
```
Sammlungsfarben (Badge-Text, Punkte): Aufläufe `oklch(0.66 0.15 60)` · Fleisch
`oklch(0.60 0.17 25)` · Nudeln `oklch(0.66 0.14 85)` · Leicht `oklch(0.60 0.12 150)` · Suppen
`oklch(0.62 0.13 40)` · Fisch `oklch(0.62 0.10 210)` · Wok `oklch(0.58 0.14 320)`.
Neue Sammlungen: Hue aus dem Namen hashen, L 0.60–0.66 / C 0.10–0.17 beibehalten.
Die oklch-Werte sind maßgeblich, die Hex-Angaben nur Näherung.

**Radien:** 999 px (Pills, Buttons, Suchfeld) · 20 px (Karten) · 22 px (Wochenband, Screen) ·
26 px (Hero-Foto) · 16 px (Notiz) · 14 px (Tag-Tiles).
**Schatten:** Karte `0 14px 34px -24px oklch(0.4 0.05 50 / .7)`, Karte-Hover
`0 24px 44px -24px oklch(0.4 0.05 50 / .8)`, Hero-Foto
`0 26px 50px -24px oklch(0.4 0.05 50 / .6)`, Notiz `0 14px 30px -16px oklch(0.4 0.05 50 / .6)`,
Primärbutton `0 10px 24px -12px oklch(0.56 0.17 32 / .8)`.
**Abstände** (4er-Raster): 6 · 8 · 10 · 12 · 14 · 16 · 18 · 22 · 26 · 34 · 40 px.

**Typografie** (Google Fonts):
```
Instrument Serif 400 — Display: 52/1.05 (Hero), 30/1 (Sektion), 26/1 (Band), 23/1.2 (Kartentitel), 17 (Notiz)
Figtree 400/500/600/700 — UI/Text: 16.5/1.6 · 15 · 14/1.5 · 13.5 · 12.5 · 11.5 uppercase (.1–.14em)
JetBrains Mono 500/700 — alle Zahlen: Zeiten, Portionen, kcal, Zählwerte (tabular-nums)
```

## Assets
- **Keine** Bilddateien im Bundle. Fotoflächen sind Platzhalter (`<image-slot>` im Prototyp) und
  kommen in der App aus `recipe.images[0]`.
- Das bisherige Unsplash-Fallback in `RecipeCard.tsx` bitte ersetzen: statt eines für alle
  Rezepte identischen Fotos eine ruhige Fläche in `oklch(0.92 0.02 80)` mit Lucide-Icon in der
  Sammlungsfarbe.
- Icons: `lucide-react` — `search`, `plus`, `clock`, `heart`, `calendar`, `utensils`,
  `chef-hat`, `arrow-right`.

## Dateien
- `Cookbook Konzept v2.dc.html` — Prototyp. Vorlagen: `id="2a"` (Bibliothek), `id="3a"`
  (Detail), `id="3b"` (Kochmodus), `id="3c"` (Wochenplaner); `2b`/`2c` nur Kontext. Im Browser öffnen; `support.js` und `image-slot.js` liegen daneben,
  damit die Datei offline läuft.
- Betroffene Repo-Dateien:
  - Bibliothek: `frontend/src/app/components/RecipeList.tsx`, `RecipeCard.tsx`
  - Detail: `RecipeDetail.tsx` / `RecipeDetailWithCarousel.tsx` (eine Variante behalten)
  - Kochmodus: neu, z. B. `frontend/src/app/components/CookMode.tsx` (+ Route/Vollbild in `App.tsx`)
  - Planer: `WeeklyPlanner.tsx`, `AddToWeekPlannerDialog.tsx`
  - Rahmen: `App.tsx` (Header/Nav), `frontend/src/styles/theme.css` (Tokens),
    `frontend/src/app/components/ui/*` (Button-, Input-, Badge-Varianten), `i18n/de.ts` + `en.ts`
    (neue Strings: „Wonach ist dir heute?", „Rezept der Woche", „Kochmodus", „Auf den
    Einkaufszettel", „Auf einen Tag legen", „frei", „Rezept wählen", „Bildschirm bleibt an")
