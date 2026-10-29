# TeamWorkout – merkgids

## Het merkteken
Drie stijgende balken: een team van drie, en tegelijk trainingsload die opbouwt. De hoogste balk is volledig in accentkleur, de andere twee zijn gedimd (50% en 75%). Geen letters, geen details, zodat het ook op 16 px leesbaar blijft.

## Kleuren
- Navy achtergrond: `#0a1020`
- Lime accent (donker thema): `#a3e635`
- Tekst (donker): `#e8edf8`
- Lichte achtergrond: `#f3f6fb`
- Emerald primair (licht thema): `#047857`
- In de app altijd `var(--primary)` gebruiken, nooit een vaste hex-waarde.

## Vrije ruimte
- Houd rondom het merkteken minimaal de breedte van een balk vrij (ca. 1/4 van de hoogte).
- Ruimte tussen teken en woordmerk: ongeveer 0,3 x de hoogte van het teken.
- Woordmerk: "Team" in tekstkleur, "Workout" in primair, extra vet.

## Minimale grootte
- Teken alleen: 16 px (favicon); in de app bij voorkeur 24 px of groter.
- Teken met woordmerk: minimaal 120 px breed.
- PWA-icoon: teken binnen de centrale 60% (maskable: 50%).

## Doen
- Teken op navy of op de lichte achtergrond gebruiken, met voldoende contrast.
- Eén kleur (primair) met de vaste dimniveaus gebruiken.
- `LogoMark` en `Logo` uit `src/components/Logo.tsx` gebruiken.
- Het teken proportioneel schalen.

## Niet doen
- De balken herordenen, uitrekken of draaien.
- Extra kleuren, verlopen, schaduwen of contouren toevoegen.
- Het teken op drukke of lage-contrast achtergronden plaatsen.
- Het woordmerk in een ander lettertype of met andere kleurverdeling zetten.
- Het teken combineren met halters of ander clipart.
