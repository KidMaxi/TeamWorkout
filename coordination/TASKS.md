# TASKS (alleen LEAD wijzigt dit bestand). Stand: 2026-11-17, basis `integration/courtload` @ ee37875.

Worktrees: iedere sessie die code wijzigt werkt in een eigen worktree `/home/user/wt/<TAAK-ID>` op een eigen branch, aangemaakt vanaf `origin/integration/courtload`:
`git fetch origin && git worktree add /home/user/wt/<ID> -b feature/<ID>-<naam> origin/integration/courtload && cd /home/user/wt/<ID> && npm ci`
Branch en worktree van een taak worden hier door LEAD vastgelegd; een sessie begint pas aan een taak die aan haar is toegewezen (status IN_PROGRESS door LEAD of expliciet "TODO, toegewezen aan jou").

| ID | Titel | Eigenaar | Status | Afhankelijk van |
|---|---|---|---|---|
| L-01 | Integratiebranch + `tools/verify.sh` + `tools/coord` | LEAD | DONE (ee37875) | |
| L-02 | README actualiseren | LEAD | DONE (ee37875) | |
| L-03 | Review en integratie van afgeronde taken | LEAD | IN_PROGRESS (doorlopend) | |
| F-01 | Hydratiewaarschuwing #418: oorzaak vinden en oplossen | FRONTEND | TODO | |
| F-02 | Kernflow-staten auditen en herstellen (loading/leeg/fout/offline) | FRONTEND | TODO | |
| F-03 | Academy-planning: weekraster vanaf 768px | FRONTEND | TODO | F-02 niet nodig |
| B-01 | RLS/DB-testsuite herhaalbaar in `supabase/tests` | BACKEND | TODO | |
| B-02 | Geboortedatum voor atleten: contract + validatie (leaderboard) | BACKEND | TODO | levert contract voor F-04 |
| B-03 | Beleids- en policy-hygiëne (advisors, sessie-delete, invite-hergebruik) | BACKEND | TODO | besluit gebruiker voor sessie-delete |
| Q-01 | Acceptatiecriteria kernflow + rol-tour in `e2e/` | QA | TODO | |
| Q-02 | Kernflow handmatig/Playwright testen tegen demo-data, bugs rapporteren | QA | TODO | Q-01 |
| Q-03 | Beveiligingsgrenzen en mobiel gedrag controleren | QA | TODO | Q-01 |
| F-04 | Geboortedatum-invoer in profiel/onboarding | FRONTEND | BLOCKED (wacht op B-02 contract) | B-02 |

## Taakdetails
### F-01 (FRONTEND) feature/F-01-hydration
Resultaat: geen React-hydratiewaarschuwing meer in de productiebuild op teamoverzicht, ledenpagina en gymsets-pagina voor de rollen basketbaltrainer en speler.
Toegestaan: `src/components/**`, `src/app/**` (geen actions.ts/api). Aanwijzingen: eerder was het `Dial` (trig-afronding, al opgelost); nu is er nog een rest in de prod-build (`next build && next start`), niet in `next dev`. Zoek server/client-verschillen (datums, locale, Math, volgorde). Rapporteer als de oorzaak niet te vinden is, met wat je uitsloot.
Acceptatie: 30 laadbeurten per betrokken pagina met Playwright (gescripte login als bas@ en noah.de.vries@) zonder `Minified React error #418`; `tools/verify.sh full` groen.

### F-02 (FRONTEND) feature/F-02-states
Resultaat: voor de kernflow (plan sessie -> speler logt -> trainer ziet status) heeft elk scherm duidelijke loading-, lege-, succes- en foutstatus, ook bij weg netwerk bij loggen.
Toegestaan: `src/components/**`, `src/app/**` (geen actions.ts/api), messages. Lever een lijst van gevonden gaten (INFO naar LEAD en QA) en herstel ze.
Acceptatie: per scherm in de lijst een geteste staat; geen horizontale scroll op 390px; `tools/verify.sh full` groen.

### F-03 (FRONTEND) feature/F-03-plan-grid
Resultaat: `/academy/planning` toont vanaf 768px een weekraster (7 kolommen) zoals de demo; kleiner blijft de dagenlijst. Acceptatie: screenshots 390/820/1280, filters en dag/week-toggle werken, verify groen.

### B-01 (BACKEND) feature/B-01-db-tests
Resultaat: alle in de sessie geschreven rolled-back tests (rolmatrix, club-beheerder, ouder, fit-status, leaderboard, weekmatrix, athlete_week, session_set_summary, set_player_info, kiosk pin vrijgeven) staan als `supabase/tests/*.sql` met een `supabase/tests/README.md` hoe ze draaien en wat het verwachte resultaat is.
Acceptatie: elk script draait vanaf nul tegen de live DB, laat geen data achter (controleer aantallen vóór/na), en bevat de verwachte uitkomst in de header.

### B-02 (BACKEND) feature/B-02-birthdate
Resultaat: contract (naar LEAD en FRONTEND) voor het vastleggen van de geboortedatum van een atleet (wie mag het zetten: atleet zelf, trainer, ouder?), validatie en een DB-regel (bijv. verplicht voor atleten bij toestemming) zonder bestaande data te breken. Eerst voorstel via TASK_PROPOSAL/QUESTION aan LEAD; pas bouwen na toewijzing.

### B-03 (BACKEND) feature/B-03-policy-hygiene
Resultaat: (a) advisor "multiple permissive policies" voor de 8 genoemde tabellen opgelost zonder gedrag te wijzigen (bewezen met B-01 tests), (b) voorstel voor het verwijderen van sessies met logs (alleen voorstel; besluit door gebruiker via LEAD), (c) voorstel voor eenmalig te gebruiken uitnodigingscodes. Alleen (a) is meteen uitvoerbaar.

### Q-01 (QA) feature/Q-01-acceptance (alleen `e2e/**` en rapport)
Resultaat: genummerde acceptatiecriteria voor de kernflow (INFO-bericht + `e2e/README.md`) en een rol-tour als `e2e/role-tour.mjs` (Playwright, demo-accounts; per rol alle schermen op 390 en 820 px, vastleggen van fouten, horizontale scroll en onverwachte redirects).
Acceptatie: draait tegen de echte app (zie PROJECT.md hoe), levert een rapport met aantallen.

### Q-02 / Q-03 (QA)
Q-02: kernflow met echte klikken: trainer (bas@) plant sessie -> speler (noah.de.vries@) logt via het overzicht -> trainer ziet de status. Ook de gym-runner offline/online. Bugs volgens het rapportformaat uit de startprompt. Q-03: rechtengrenzen (speler/ouder/beheerder proberen andermans data, URL-manipulatie, server actions met vreemde ids) en mobiel gedrag. QA wijzigt geen productcode.
