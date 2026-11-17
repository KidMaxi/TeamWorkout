# Courtload

PWA voor load- en beschikbaarheidsbeheer van een basketbalacademy: academy-, gym- en avondtrainingen en wedstrijden,
per team en over de hele academy. Next.js 15 (App Router), Supabase (Postgres, Auth, RLS), Vercel.

## Wat zit erin
- **Rollen:** hoofdcoach, basketbaltrainer, S&C-coach (een persoon kan meerdere functies en teams hebben), medisch, atleet,
  ouder (alleen eigen kind, alleen lezen) en clubbeheerder (alleen lezen, geen gezondheidsdetails).
- **Plannen en loggen:** trainers plannen sessies; atleten loggen aanwezigheid, minuten en RPE (load = RPE x minuten), snel op het overzicht.
- **Gym:** workouts met oefeningenbibliotheek, 5RM-tests met RPE-tabel, workout-runner voor de atleet, iPad-modus met pincode, offline-wachtrij voor sets.
- **Workload en check-in:** weekregels per team, dagwaarschuwingen, dagelijkse check-in (met toestemming), fit-status per speler.
- **Academy:** weekoverzicht over alle teams, academy-planning, leaderboard (onder 16 uitgesloten), gelogde sets per gymsessie.
- Tweetalig (NL/EN), PWA met service worker, web push (inactief tot de variabelen in `.env.example` gezet zijn).

## Draaien
```bash
cp .env.example .env.local   # vul URL en publishable key van het Supabase-project in
npm install
npm run dev
```
Verifiëren: `tools/verify.sh` (snel) of `tools/verify.sh full` (met build en offline-e2e).

## Database
Supabase-project `teamworkout` (`xkbbgwndtcfnkifhmles`). Migraties staan in `supabase/migrations`, rechten lopen via row-level security.
Herhaalbare rol-/RLS-testscripts: `supabase/tests`. Demo-academy (alleen voor demo's en schermafbeeldingen): `supabase/seed/demo_academy.sql`.

## Documentatie
`docs/COURTLOAD-PLAN.md` (productplan en voortgang), `docs/BRAND.md`, `docs/NOTIFICATIONS.md`, `docs/legal/*` (concepten, juridisch niet beoordeeld).
Samenwerking tussen meerdere sessies: zie `tools/coord/` en de `coordination/`-bestanden op de branches `coord/*`.
