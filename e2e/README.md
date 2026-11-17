# e2e: acceptatiecriteria en tests (QA)

## Scripts
| Script | Doel | Data |
|---|---|---|
| `offline-runner.mjs` | Gym-runner offline wachtrij (7 scenario's) | nagebootste server (`E2E_HARNESS=1`), geen Supabase |
| `role-tour.mjs` | Rol-tour: alle schermen per rol op 390 en 820 px | echte app + demo-accounts, **alleen lezen** |

### role-tour draaien
```bash
# bouwen en starten tegen de echte DB (zie PROJECT.md "Verifiëren")
export NEXT_PUBLIC_SUPABASE_URL=https://xkbbgwndtcfnkifhmles.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key> \
  NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt NODE_NO_WARNINGS=1
npm run build && npx next start -p 3200 &
BASE_URL=http://localhost:3200 node e2e/role-tour.mjs [--roles bas,noah] [--out rapport.json]
```
Wachtwoord: `DEMO_PASSWORD` of de kop van `supabase/seed/demo_academy.sql`. Duur: ca. 10+ min voor alle 7 rollen (gebruik `--roles` of draai op de achtergrond).
Per bezoek wordt vastgelegd: HTTP-status, eind-URL (onverwachte redirect), `pageerror`/console-fouten (hydratie #418 = middel), mislukte same-origin-requests (`/_vercel/*` genegeerd buiten Vercel), horizontale scroll, zichtbare foutpagina met status < 400, ontbrekende `<h1>`.
Het `DENY`-blok in het script bevat de routes die een rol NIET mag openen; inhoud daar = **kritiek (rechtenlek)**.
Exitcode: 0 = geen bevindingen (behalve info), 1 = bevindingen, 2 = tour kon niet draaien. Bevindingen met ernst: kritiek/hoog/middel/laag/info.

## Acceptatiecriteria kernflow (genummerd, verwijs hiernaar in bugrapporten)
Basis: PROJECT.md "Kernflow", CONTRACTS.md, DECISIONS.md. Demo-accounts: bas@ (trainer), noah.de.vries@ (speler).

**A. Sessie plannen (trainer)**
- A1. Trainer kan voor het EIGEN team een sessie plannen van type academy/gym/avond/wedstrijd (datum, tijd, titel); na opslaan staat de sessie direct in `/team/[id]/sessions` en de kalender.
- A2. Een trainer kan geen sessie voor een team plannen waarvan hij geen lid is, en alleen de types waarvoor zijn staf-functie bevoegd is (`canPlanType`, `can_plan_*`).
- A3. Ongeldige invoer (lege titel, einde voor begin, ongeldige datum) geeft een duidelijke foutmelding in de UI, geen crash en geen halve sessie.
- A4. Een geplande sessie annuleren/uitsluiten blokkeert loggen daarop (trigger); de UI toont de geannuleerde status.

**B. Speler logt (2 tikken)**
- B1. Speler ziet openstaande/komende sessies op zijn overzicht en logt aanwezig/afwezig + minuten + RPE in maximaal 2 tikken vanaf dat overzicht.
- B2. Afwezig loggen vraagt geen RPE/minuten; de sessie telt niet mee voor load.
- B3. Een speler kan alleen voor zichzelf en alleen voor sessies van zijn team loggen; een tweede log voor dezelfde sessie wijzigt of weigert (geen dubbele rij).
- B4. Na loggen is het resultaat direct zichtbaar (succesmelding, overzicht bijgewerkt) en blijft na herladen staan.
- B5. Fout of weg netwerk bij loggen: duidelijke foutstatus, invoer niet kwijt, opnieuw proberen mogelijk.
- B6. Gym-runner: sets loggen werkt online en offline (wachtrij), afronden na de sets; geen tweede afronding; offline-scenario's uit `offline-runner.mjs` blijven groen.

**C. Trainer ziet status (5 seconden)**
- C1. Teamoverzicht toont per speler fit / minder fit / niet fit (of onbekend) en de weekload; de reden alleen voor staf van dat team.
- C2. Een log van de speler (B1) verschijnt in weekload/workload van de trainer na verversen (juiste dag Europe/Amsterdam, load = RPE x minuten).
- C3. Niet-gelogde sessies zijn zichtbaar als "ontbrekend" (`team_missing_logs`).
- C4. Academy-overzicht: staf ziet alleen eigen teams, beheerder alle teams maar nooit gezondheidsdetails (D-04, D-05).

**D. Rollen en privacy (grenzen)**
- D1. Speler ziet geen teamoverzicht/workload/ledenbeheer/kiosk/review van anderen (404 of redirect); ouder alleen zijn kind (alleen lezen); beheerder alleen lezen en geen reden/wellness/pincodes.
- D2. Niet-leden: `/team/[id]` -> beheerder naar `/academy`, ouder naar `/parent`, anderen 404.
- D3. Niet-ingelogd: elke route behalve `/login`, juridische pagina's en statische assets redirect naar `/login`.
- D4. Spelers < 16 of zonder geboortedatum staan niet op het leaderboard (D-06).

**E. Kwaliteit (alle schermen)**
- E1. 390 px: geen horizontale scroll; 820 px idem.
- E2. Geen console-/pageerrors, geen React-hydratiefout, geen 5xx.
- E3. Elk scherm heeft een heldere loading-, lege-, succes- en foutstatus.
- E4. Tikdoelen >= 44 px (iPad-modus >= 56 px), labels bij invoer, zichtbare focus; `<main>`-landmark en een `<h1>` per pagina.
- E5. NL en EN hebben identieke teksten voor de kernflow; geen ruwe sleutels zichtbaar.

Dekking: de `role-tour` toetst E1, E2, D1 (routes), D2/D3 gedeeltelijk, E4 (`<h1>`/`<main>`). A, B, C en de rest van D/E zijn taak Q-02/Q-03 (echte klikken, Playwright).
