# PROJECT: Courtload (bijgewerkt door LEAD, 2026-11-17)

Een nieuwe sessie zonder gespreksgeschiedenis begint hier. Houd dit bestand compact; details staan in CONTRACTS.md, TASKS.md, DECISIONS.md.

## Product
Courtload is een PWA voor load- en beschikbaarheidsbeheer van een basketbalacademy (teams, trainers, spelers, ouders).
Coach beslist, de app adviseert alleen. Er zijn minderjarigen: privacy by design (AVG), gezondheidsdata alleen met toestemming.
Eigenaar/opdrachtgever: de gebruiker (Nederlandstalig). Taal in de app: NL standaard, EN erbij. Productnaam: **Courtload**.

## Kernflow (dit moet altijd werken, boven alles)
1. Trainer plant een sessie (academy/gym/avond/wedstrijd) voor zijn eigen team.
2. Speler logt de sessie (aanwezig/afwezig, minuten, RPE) in 2 tikken op zijn overzicht, of voert een gymworkout uit (runner, ook offline).
3. Trainer ziet in 5 seconden wie fit / minder fit / niet fit is en de weekload (teamoverzicht, workload, academy-overzicht).
Secundair: leaderboard, ouderaccount, beheerder, iPad-modus met pincode, check-in, 5RM.

## Stack en omgeving
- Next.js 15 App Router, React 19, Tailwind v4, TypeScript. Eigen typed i18n (`src/lib/i18n`, `defineMessages`, NL+EN met IDENTIEKE sleutels; typecheck dwingt dit af).
- Supabase project `xkbbgwndtcfnkifhmles` (naam `teamworkout`, EU): Auth (e-mail/wachtwoord), Postgres met RLS, security-definer RPC's. De DB is LIVE gedeeld door alle sessies.
- Vercel: project `team-workout-zkzf` bouwt branch `claude/optimistic-hamilton-ngxqoa` als PRODUCTIE. Niet pushen naar die branch zonder opdracht van de gebruiker. (Er is een dubbel project `team-workout` zonder env-variabelen; negeren.)
- Design: één donker thema, oranje accent, Bebas Neue + Barlow (zie docs/BRAND.md, tokens in src/app/globals.css). Gelijk aan de Lovable-demo.
- PWA: service worker `public/sw.js` (alleen /_next/static en /icons gecachet, nooit HTML/API), offline-wachtrij voor gymsets (`src/lib/sync-queue.ts`).

## Repository en branches
- Integratiebranch: `integration/courtload` (basis commit ee37875 op 2026-11-17). Alle werk gaat via `feature/<taak-id>-<naam>` of `fix/<taak-id>-<naam>` naar LEAD, die integreert naar `integration/courtload`.
- `claude/optimistic-hamilton-ngxqoa` = productie (Vercel). Alleen op expliciete opdracht van de gebruiker, door LEAD.
- Coördinatie leeft op branches `coord/<ROLE>` (zie hieronder), NIET in de productcode.

## Hoe sessies communiceren (belangrijk: er is GEEN gedeelde map)
Cloudsessies hebben elk een eigen container; een gezamenlijke absolute map bestaat niet. Gedeelde bestanden lopen via Git:
- Elke rol schrijft alleen naar haar eigen branch `origin/coord/<ROLE>` (bevat alleen haar sessions/<ROLE>.md en outbox/<ROLE>/; LEAD ook PROJECT/TASKS/CONTRACTS/DECISIONS/startprompts).
- Lezen: `tools/coord/coord-sync.sh <ROLE>` haalt alle coord/* branches op, bouwt een read-only beeld in `$HOME/coord-view/coordination/` en toont ongelezen berichten (ID staat niet in je sessions/<ROLE>.md).
- Schrijven: `tools/coord/coord-send.sh FROM TO TYPE TASK "onderwerp" [antwoord-op-ID] < tekst` (publiceert atomisch: tmp-bestand, rename, commit, push) en `tools/coord/coord-publish.sh <ROLE> "bericht"` voor je eigen statusbestand (te bewerken in `$HOME/coord-work-<ROLE>/coordination/sessions/<ROLE>.md`).
- Berichtformaat en types: zie startprompts of het script. Geen automatische activatie: een sessie ziet nieuwe berichten alleen als zij zelf sync't (bij start, voor een nieuwe taak, na een werkstap, voor oplevering). De gebruiker (of LEAD via een bericht aan een door LEAD gestarte sessie) moet een stilstaande sessie handmatig hervatten.

## Eigenaarschap van bestanden
- LEAD: package.json, lockfile, configs (next.config.ts, tsconfig, eslint), `src/middleware.ts`, `tools/**`, `docs/**`, `README.md`, integratie.
- FRONTEND: `src/app/**` (behalve `actions.ts`, `api/**`), `src/components/**`, `src/lib/i18n/messages/**`, `public/**`, `src/app/globals.css`.
- BACKEND: `supabase/**`, `src/app/**/actions.ts`, `src/app/api/**`, `src/lib/run-writes.ts`, `src/lib/roles.ts`, `src/lib/auth-cache.ts`, `src/lib/supabase/**`, `src/lib/workload*.ts`, `src/lib/academy.ts`.
- QA: `e2e/**` en rapporten; productcode alleen op expliciet toegewezen herstel-taak met eigen branch.
- Alleen BACKEND past de live database aan (migraties via de Supabase MCP-tools); alle anderen alleen lezen of teruggedraaide tests.

## Verifiëren
`tools/verify.sh` (tsc, eslint, unit tests; `full` voegt build en offline-e2e toe). Niet gedekt: gedrag in een echte browser tegen Supabase, mobiele layout, RLS: zie `supabase/tests` en QA-taken. Een geslaagde build is geen functionele test.
Lokaal tegen de echte DB draaien in de cloudsandbox: `NEXT_PUBLIC_SUPABASE_URL=https://xkbbgwndtcfnkifhmles.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key> NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt npm run build && npx next start -p <poort>` (Node mag Supabase in de sandbox alleen via de proxy bereiken). De publishable key staat in de Supabase-dashboard/MCP en in `tools/verify.sh`.
Demo-omgeving: `supabase/seed/demo_academy.sql` is al in de live DB gezaaid (club 'Voorbeeldacademy', 18 spelers, 5 teams). Accounts: hugo@ (hoofdcoach), bas@ (basketbal U19), gwen@ (S&C U19), eva@ (basketbal+S&C), anna@ (beheerder), petra@ (ouder van Noah), noah.de.vries@ en andere spelers, allemaal `@demo.courtload.test`; het wachtwoord staat in de kop van `supabase/seed/demo_academy.sql`. Verwijder of herschrijf demo-data niet zonder opdracht; test-data die je zelf maakt krijgt prefix `qa-` en wordt door jou opgeruimd.

## Bekende open punten (stand 2026-11-17)
- Sporadische React-hydratiewaarschuwing #418 in de productiebuild (niet reproduceerbaar in dev). Zichtbaar effect: geen. -> F-01.
- Spelers zonder geboortedatum tellen als onder 16 en staan niet op het leaderboard. -> B-02.
- Juridisch: `src/lib/legal.ts` heeft lege exploitantgegevens en `reviewed=false`; teksten zijn concepten.
- Web-push is inactief tot de variabelen uit `.env.example` zijn gezet. Geen secrets in Git.
- Directe DELETE van een sessie met logs is via RLS toegestaan (alleen de app-code beschermt). Productbesluit nodig. -> B-03.
- RISICO (open, besluit gebruiker): de GitHub-repo KidMaxi/TeamWorkout is PUBLIEK. Het demo-wachtwoord staat in het seed-script en de demo-accounts bestaan in het live Supabase-project. Advies: repo privé maken, of de demo-accounts verwijderen/het wachtwoord vervangen zodra de demo's klaar zijn. Zet geen echte persoonsgegevens, secrets of productiegegevens in berichten of coord-bestanden (ze zijn publiek leesbaar).
