# Courtload – merkgids

## Het merkteken
Drie stijgende balken: een team van drie, en tegelijk trainingsload die opbouwt. De balken zijn 60%, 80% en 100% hoog, hebben licht afgeronde hoeken (rounded-sm) en staan alle drie in het accent. Geen letters, geen details, zodat het ook op 16 px leesbaar blijft.

## Look en gevoel
De look volgt de Lovable-demo (courtstride-player-care.lovable.app): een donkere, vlakke sporthal-sfeer, geen lichte variant.
- Vlakke antracieten vlakken met een 1px rand; geen gloed, verloop of schaduw als versiering.
- Vierkante hoeken: 6 px (`var(--radius)`, `rounded-md`). Geen pillen en geen `rounded-2xl`/`3xl`; `rounded-full` alleen voor avatars, stippen en meters.
- Oranje alleen voor de primaire actie, de actieve staat, eyebrows en kerncijfers.
- Paginakop: kleine oranje eyebrow (bijv. "ACADEMY PERFORMANCE / WORKLOAD") boven een grote Bebas-h1; KPI's als grote Bebas-cijfers met een klein, gedempt hoofdletterlabel; compacte tabelachtige lijsten.

## Kleuren
Eén thema: donker. Tokens staan in `src/app/globals.css`; in de app altijd `var(--token)` gebruiken, nooit een vaste hex-waarde.
- Achtergrond: antraciet `oklch(20.5% 0 0)` (ca. `#1b1b1b`), vlakken `--surface` `oklch(27% 0 0)` (ca. `#2a2a2a`), `--surface-2` en `--surface-3` iets lichter.
- Lijnen: `--line` `oklch(38% 0 0)` (ca. `#4a4a4a`).
- Tekst: `--foreground` warm gebroken wit (ca. `#f2efe8`), `--muted` gedempt (ca. `#b5b1a8`).
- Accent en primair: oranje `#e8602c` = `oklch(65% .18 40)` (`--primary`, `--accent`), tekst erop `--on-primary` (antraciet).
- Zonekleuren: `--ok` groen, `--warn` geel, `--danger` rood; alleen voor belastingstatus en meldingen.

## Typografie
- Koppen en grote cijfers: **Bebas Neue** (`font-display`, klassen `display` en `num`, ook h1 tot h3). Het lettertype heeft één gewicht: nooit `font-bold` of `font-extrabold` toevoegen.
- Lopende tekst en formulieren: **Barlow**.
- Eyebrow: klein, hoofdletters, ruim gespatieerd, in oranje (`.eyebrow`).

## Vrije ruimte
- Houd rondom het merkteken minimaal de breedte van een balk vrij (ca. 1/4 van de hoogte).
- Ruimte tussen teken en woordmerk: ongeveer 0,3 x de hoogte van het teken.
- Woordmerk: **COURTLOAD** in hoofdletters, Bebas Neue en ruim gespatieerd: "COURT" in voorgrondkleur (tekstkleur), "LOAD" in het accent (zoals in de Lovable-demo courtstride-player-care). Component: `Logo` in `src/components/Logo.tsx`.
- Productnaam in lopende tekst: "Courtload" (voorheen TeamWorkout).

## Minimale grootte
- Teken alleen: 16 px (favicon); in de app bij voorkeur 24 px of groter.
- Teken met woordmerk: minimaal 120 px breed.
- PWA-icoon: oranje teken op antraciet `#1b1b1b`, binnen de centrale 60% (maskable: 50%). `src/app/icon.svg` heeft een transparante achtergrond.

## Doen
- Teken op antraciet gebruiken, met voldoende contrast.
- Eén kleur (oranje primair) gebruiken; het hoogteverschil geeft de opbouw.
- `LogoMark` en `Logo` uit `src/components/Logo.tsx` gebruiken.
- Het teken proportioneel schalen.

## Niet doen
- De balken herordenen, uitrekken of draaien.
- Extra kleuren, verlopen, schaduwen of contouren toevoegen.
- Het teken op drukke of lage-contrast achtergronden plaatsen.
- Het woordmerk in een ander lettertype of met andere kleurverdeling zetten.
- Het teken combineren met halters of ander clipart.
