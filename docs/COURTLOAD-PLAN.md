# Courtload-demo → backendplan

Bron: https://courtstride-player-care.lovable.app (alle 6 rollen en alle tabs doorgelopen met een echte browser,
desktop 1280px en telefoon 390px). Datum: 2026-11-17. De demo heeft geen backend; alles hieronder over gedrag is
afgeleid uit wat zichtbaar is, niet uit code.

## 1. Wat de demo laat zien

**Concept:** één academy (nu "Voorbeeldacademy") met meerdere teams (Jongens U19, Jongens U22, Vrouwen U21, U16-1,
U16-2), 18 spelers, belasting in AU (= sRPE: RPE × minuten). "Werkelijke belasting" telt alleen gelogde sessies;
geplande trainingen tellen niet mee.

**Tabs en wie ze ziet**

| Tab | Hoofd S&C | Basketbaltrainer | Gymtrainer | Speler | Beheerder | Ouder |
|---|---|---|---|---|---|---|
| Planning (week/dag) | alle teams, **Training plannen** | idem (zijn team?) | idem | eigen week | alles, alleen lezen | eigen kind |
| Basketbal (teams + selectie + week) | ja | ja | nee | nee | ja | nee |
| Gym (workouts, doelgewichten, gelogde sets) | **Nieuwe workout** | nee | **Nieuwe workout** | **Set loggen** | alleen lezen | nee |
| Workload (week, dagbelasting, check-in-lijst, tabel per speler) | alle 18 spelers | "Mijn team" (3) | "Mijn team" (3) | nee | alle 18 | "Mijn kind" (1) |
| Leaderboard (club records bench/squat/deadlift) | ja | ja | ja | ja | ja | nee |
| Profielen | alle spelers | eigen "Profiel" | eigen "Profiel" | eigen profiel (naam bewerken) | alle, alleen lezen | eigen "Profiel" |

**Schermen in detail**
- **Planning:** weekkalender ma–zo met kleurcodes (basketbal blauw, gym oranje, wedstrijd geel), weeknavigatie, "Deze week",
  Week/Dag-schakelaar. "Training plannen" opent een formulier: titel, dag, tijd, team, soort (basketbal/gym/wedstrijd),
  minuten. Elke sessie toont tijd·duur, titel, team, "Gepland · N AU".
- **Basketbal:** kaart per team (aantal spelers, "Bekijk selectie") en daaronder dezelfde weekplanning gefilterd op basketbal.
- **Gym:** links lijst workouts (naam, dag, aantal oefeningen, team), rechts detail: oefening / sets / herhalingen /
  doelgewicht (vast kg of lichaamsgewicht). Daaronder "Gelogde sets" per speler: één regel
  ("Bench press · 4 × 6 × 70 kg · Gelogd ✓"). Nieuwe workout: naam, dag, team, oefeningenrijen (sets/reps/kg).
  Speler: knop **Set loggen** (één klik, geen invoer).
- **Workload:** vier KPI's (spelers in beeld, weekbelasting, gelogde trainingen, gymtrainingen), staafdiagram
  dagbelasting, kaart "Dagelijkse check-in" (spelers met pijn/ziek/slecht geslapen, "Zelfgerapporteerd · los van
  trainingsbelasting"), tabel per team met per speler ma–zo AU, week-AU, sessies en "eigen weekgemiddelde over 28 dagen",
  team totaal en teamgemiddelde, zoeken en teamfilter, sorteren op week-AU.
- **Leaderboard:** per oefening (bench/squat/deadlift) top 3 als kaarten, rest als lijst met kg.
- **Profielen:** kaart per speler: rugnummer, naam, team, positie, aantal gelogde trainingen, check-in
  (Goed / Minder fit / Niet fit) met reden (bv. "Pijn · linkerknie").
- **Login:** e-mail/wachtwoord, Google, Lovable, aanmelden. Staf en spelers gebruiken dezelfde login.

**Look:** donker, oranje accent, hoge smalle kopletter (Bebas-achtig), foto-hero van basketbal. Naam **COURTLOAD**.

## 2. Verschil met de huidige app (TeamWorkout)

Wat al bestaat en overgenomen kan worden zonder nieuwe backend: rollen via `staff_kind`, kalender met sessies en types,
workload-RPC's, wellness-check-in met toestemming, gymworkouts + runner + kiosk, 5RM-tests, clubniveau
(`clubs`, `teams.club_id`).

Wat de demo wél vraagt en de app nog niet heeft:
1. **Academy-overzicht over alle teams tegelijk** (Workload, Planning, Profielen). Mijn app is per team opgezet; het
   clubniveau bestaat in de database maar niet in de schermen of RPC's.
2. **Rol Beheerder** (alleen lezen, hele academy).
3. **Rol Ouder** met koppeling aan een kind en een aparte "Mijn kind"-weergave.
4. **Teamgebonden rol voor Gymtrainer** (ziet alleen eigen team in Workload, maar mag workouts maken).
5. **Rugnummer en positie** per speler.
6. **Leaderboard** (club records per oefening).
7. **Gelogde-sets-overzicht per speler** per workout (samenvatting).
8. **Check-in als status** (Goed / Minder fit / Niet fit + reden) op profielkaart en in de workloadlijst.
9. **Eigen weekgemiddelde over 28 dagen** per speler in de tabel (de RPC heeft chronic_weekly_avg, per week gemiddeld; kolommen
   per dag ontbreken en moeten per speler/dag geleverd worden).
10. **Look & naam** (zie beslissing A).

Wat de app al beter doet dan de demo (niet weggooien): RPE-logging per sessie, wellness-vragen, toestemming
voor minderjarigen, offline-wachtrij, iPad-kiosk met pincode, workoutruns met setsoorten, RPE-tabel-gewichten,
weekregels en dagwaarschuwingen.

## 3. Tegenstrijdigheden en gaten in de demo (eerst oplossen, anders bouw ik het verkeerd)

1. **De demo toont geen scherm om een basketbaltraining te loggen.** De intro belooft "Players log minutes and effort
   after every session", maar spelers hebben alleen "Set loggen" voor gym. Er is ook geen formulier voor de
   dagelijkse check-in; alleen de uitkomst wordt getoond. Wie voert dit in, en wanneer?
2. **"Werkelijk" is gelijk aan "gepland".** Elke sessie in de week haalt precies de geplande AU (bv. 450 AU = 75 min × RPE 6).
   Dat lijkt demo-data, maar het betekent dat er nergens zichtbaar is hoe werkelijk en gepland uit elkaar lopen.
3. **"2 gymtrainingen per speler" klopt niet met de tabel.** Bram Jacobs heeft in totaal 1 sessie, Zoë Visser 2, en de
   KPI "36" is gewoon 18 × 2. De cijfers moeten uit de gelogde data komen.
4. **Gezondheidsgegevens staan open.** Pijn-locatie, ziekte en slaap staan in de Workloadlijst, op de profielkaarten
   en zijn zichtbaar voor Beheerder (alleen lezen) en alle coaches. Bij minderjarigen (U16) is dit bijzondere
   persoonsgegevens; mijn huidige model laat het alleen zien met toestemming. De demo laat dat weg.
5. **Leaderboard toont iedereen aan iedereen**, ook aan spelers en onder 16-jarigen (Bram Jacobs 15 kg bench press
   op plaats 18 van 18). Kan demotiverend of beschamend zijn en is mogelijk niet gewenst voor jongere teams.
6. **De Gymtrainer en Basketbaltrainer zien alleen hun eigen team (Jongens U19)**, maar ze kunnen in Planning wel
   alle sessies zien en plannen. Is planning teamgebonden of academybreed?
7. **Rollen zijn niet exclusief.** Hoofd S&C is zowel basketbal als gym; een trainer kan beide zijn. In de demo is het een
   schakelaar, in het echt moet het per team en per persoon instelbaar zijn.
8. **Positie en rugnummer** zijn vrije tekst in de demo; geen validatie, geen uniekheid per team.
9. **De demo is desktopfirst.** Op 390px loopt de navigatie over drie regels, de oranje demobalk neemt 150px in, er is geen
   onderste navigatiebalk en KPI-blokken staan scheef. Dit moet niet 1-op-1 worden overgenomen; spelers loggen op hun
   telefoon.

## 4. Beslissingen die ik van jou nodig heb voordat stap 1 begint

| # | Vraag | Mijn voorstel |
|---|---|---|
| A | Looks: de Courtload-look (donker, oranje, smalle koppen, hero-foto) overnemen of onze eigen look houden? En de naam COURTLOAD of TeamWorkout? | Overnemen als het de wens van je broertje en jou is; dan wordt dit de enige look. Dit is puur CSS/branding en staat los van de backend. |
| B | Gezondheidsdata (check-in details, pijn, ziekte) tonen aan Beheerder, Ouder, Gymtrainer? | Beheerder: alleen status (Goed/Minder fit/Niet fit), geen reden. Ouder: eigen kind, met toestemming. Trainers: eigen team. Alles onder 16 alleen met ouderlijke toestemming. |
| C | Leaderboard zichtbaar voor spelers en onder 16? | Per team aan/uit door de hoofdcoach; standaard uit onder 16. |
| D | Is planning academybreed (iedere trainer plant overal) of teamgebonden? | Teamgebonden, hoofd S&C academybreed. |
| E | Mag een trainer meerdere rollen hebben (basketbal + gym) en in meerdere teams? | Ja: rol per team per persoon. |
| F | Wie logt en wanneer? (basketbal-RPE, check-in, gymsets) | Wat we al hebben: sessielog + check-in op het overzicht, gym via runner/kiosk. De demo "Set loggen" vervangt dat niet. |
| G | Rugnummer/positie: door speler of coach in te vullen? | Coach (voor uniekheid), speler mag zelf positie. |

## 5. Stappenplan (backend eerst, UI volgt per stap)

Principe: elke stap eindigt met (1) migratiebestand in `supabase/migrations`, (2) RLS getest met rolled-back SQL per rol,
(3) server-acties of RPC's, (4) schermen, (5) tsc/lint/tests/build/e2e groen, (6) korte demo-aanwijzing voor jou.
Niets wordt in productie gezet zonder dat de database-wijziging eerst getest is. Alles blijft backwards compatible.

**Stap 0 — Beslissingen A–G** (jij). Looks (A) kan los daarvan.

**Stap 1 — Academy- en rollenlaag**
- Datamodel: `club_members(club_id, user_id, role: admin|head_sc|coach|parent|athlete)`; bestaande `team_members.staff_kind`
  blijft voor teamrechten. Eén rol per team per persoon; clubrol afgeleid of expliciet.
- Functies: `is_club_admin`, `can_view_team`, `can_plan_team(team)`, `can_view_wellness_detail`. Migratie van huidige staf
  (head → head_sc, basketball/sc → coach).
- RLS opnieuw nagelopen per tabel; alleen-lezen beheerder = alleen select-policies.
- Test: matrix van rollen × tabellen, vergeleken met `src/lib/roles.ts` (bouwt voort op de audit van 2026-11-03).

**Stap 2 — Spelersprofiel**
- `team_members.jersey_number` (uniek per team), `position` (enum van 5 basketbalposities).
- UI: speler zelf positie; coach rugnummer. Profielkaart.

**Stap 3 — Academy-overzichts-RPC's**
- `academy_week_matrix(_club, _week_start)` → per speler: team, dagbelasting ma–zo, week-AU, sessies, eigen 28d-weekgemiddelde.
- `academy_kpis(...)`: spelers, week-AU, gelogde trainingen, gymtrainingen (uit echte logs, niet gepland).
- `academy_daily_load(...)` voor het staafdiagram. Alles rolgebonden (team-scope) en met Amsterdam-weekgrenzen.
- Indexen op (session_id, user_id), (team_id, starts_at).
- Test: fixtures met 5 teams, cancelled/excluded/afwezig, en toegang per rol.

**Stap 4 — Check-in als status**
- Afgeleide `fit_status` (Goed/Minder fit/Niet fit) uit `wellness_checks` + beschikbaarheid, met redenen alleen voor wie mag (B).
- RPC `team_checkin_flags(_team)` voor de lijst. Bestaande toestemmingsregels blijven leidend.

**Stap 5 — Planning-schermen**
- Academy-weekkalender met filters (team, soort), dagweergave, snelle "Training plannen" (titel, dag, tijd, team, soort, minuten)
  bovenop de bestaande planner. Geen nieuwe tabellen nodig (sessions bestaat al).

**Stap 6 — Gym: overzicht en leaderboard**
- `workout_runs` samenvatting per sessie per speler (`gym_logged_sets_summary`).
- Leaderboard: `club_records(_club, _exercise)` = beste gelogde/geteste 5RM per speler; zichtbaarheid per team (C). Alleen
  oefeningen met `exercises.kind = 'weight_reps'` en een 5RM-test.

**Stap 7 — Ouder-rol**
- `parent_links(parent_user, child_user, verified_at)`; uitnodiging via code of mail door coach/hoofd.
- Beperkte views: kind-weekbelasting (geen check-in-details zonder toestemming) en kind-planning. Alleen lezen.

**Stap 8 — Beheerder**
- Alleen-lezen rol met academy-views, zonder gezondheidsdetails (B), met auditlog van wat is geraadpleegd.

**Stap 9 — Look & mobiel (staat los van de backend, kan parallel)**
- Beslissing A. Anders alleen de schermstructuur van de demo overnemen op onze eigen componenten.
- Mobiele versie ontwerpen (onderste navigatie, geen gestapelde bovenbalk): de demo is hier niet het voorbeeld.

**Stap 10 — Pilot**
- 1–2 teams, twee weken. Meten: tijd om training op te zetten, logpercentage op de dag zelf, uitval.

## 6. Risico's

- **Scope-explosie:** de demo is drie keer zoveel scherm als backend. Elke stap is daarom op zichzelf live te zetten.
- **Privacy:** Stap 4, 7 en 8 raken gezondheidsdata van minderjarigen. Jurist nodig voor bewaartermijn en rolbeschrijving.
- **Rollenmatrix:** de huidige audit vond al gaten (staf-rollen konden te veel). Elke nieuwe rol vergroot dat risico; testen per rol is verplicht.
- **Demo-data leidt tot verkeerde verwachtingen:** zie sectie 3, punten 2–3: cijfers in de demo zijn niet bruikbaar als specificatie.
- **Niet gecontroleerd:** de demo is een statische mock; gedrag achter knoppen (opslaan, filters, "Bekijk selectie") is
  niet getest en deels niet geïmplementeerd ("Opslaan in voorbeeld").
