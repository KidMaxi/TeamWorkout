# CONTRACTS (LEAD). Wijzigingen alleen via een bericht aan LEAD. Stand: basis ee37875.

## 1. Rollen en rechten
- Bron TS: `src/lib/roles.ts` (`can(kinds, capability)`, `getStaffKinds`, `kindsFromRow`, `canPlanType`). Bron DB: helperfuncties `has_staff_kind`, `is_team_head`, `is_team_planner`, `can_plan_gym`, `can_plan_court`, `is_club_sc`, `sc_staff_with`, `is_club_admin`, `parent_of`.
- TS en DB moeten gelijk blijven. Test: `supabase/tests/roles_matrix.sql` (eindigt altijd in een exception met het resultaat; niets blijft staan).
- Staf-functies: head, sc, basketball, medical. Een persoon kan per team een primaire functie + extra functies hebben. Clubbeheerder en ouder zijn GEEN teamleden.
- Regel: een query op `team_members` zonder `user_id`-filter geeft ook de rijen van collega's terug (RLS). Pagina's moeten altijd zelf op `user_id` filteren.
- Non-members: `/team/[id]` stuurt clubbeheerder naar `/academy` en ouder naar `/parent`, anderen 404.

## 2. Data-toegang in de app
- Server components: `createClient()` uit `src/lib/supabase/server.ts` (React-cache per request) en `getAuthUser/getMembership/getProfile/getLocale/getT` uit `src/lib/auth-cache.ts`. Middleware (`src/middleware.ts`) laat alleen /login, legal pagina's, statische assets en /images door zonder sessie.
- Geen service-role key in clientcode of Git. Alleen `NEXT_PUBLIC_SUPABASE_URL` en de publishable key zijn publiek.
- Server actions: signature `(…args) => Promise<{ ok: boolean; error?: MessageKey }>` voor mutaties met verwachte fouten; onverwachte fouten gooien (error.tsx vangt). Elke action her-autoriseert zelf (signed-in, lidmaatschap/capability, UUID-validatie) en vertrouwt nooit client-ids. `revalidatePath` na schrijven.
- RPC-fouten: korte codes in de exception-tekst (`not allowed`, `invalid_*`, `last_head`, `jersey_taken`, `too_many_invites`, `already_finished`, `session_cancelled`, `excluded`, `pin_locked`, `pin_not_set`, `staff_kind_required`...). De action vertaalt naar een bestaande `MessageKey`.

## 3. RPC-contracten (live in de DB)
Lezen / overzicht
- `academy_week_matrix(_club uuid, _week_start date default null)` -> rows(team_id, team_name, user_id, full_name, jersey_number smallint, position text, day_au int[7] ma..zo, week_au, sessions, gym_sessions, avg_28d). Staf ziet alleen eigen teams, clubbeheerder alle teams van de club, atleten niets. Dagen volgen Europe/Amsterdam; alleen gelogde (aanwezige) sessies, niet-geannuleerd, niet uitgesloten.
- `athlete_week(_user uuid, _week_start date default null)` -> zelfde kolommen; speler zelf, ouder, staf van zijn team, beheerder.
- `academy_fit_status(_club uuid, _day date default null)` -> rows(team_id, user_id, status 'fit'|'less_fit'|'not_fit'|'unknown', reason_code, reason_detail). Reden alleen voor staf van het team (beheerder: NULL). Check-in-gebaseerde status alleen met toestemming.
- `leaderboard_access(_club) boolean`, `club_record_exercises(_club)`, `club_records(_club, _exercise)`: < 16 of zonder geboortedatum nooit zichtbaar of rangschikbaar.
- `session_set_summary(_session)` -> rows(user_id, full_name, jersey_number, exercise_id, exercise_name, sets, top_weight_kg, top_reps, finished); staf/beheerder zien allen, speler zichzelf, ouder zijn kind.
- `team_load_overview(_team)`, `team_missing_logs(_team)`, `team_week_trend(_team, _weeks)`: alleen staf; alleen atleten; Amsterdam-weken.
Schrijven
- `set_staff_kinds(_team,_user,_primary,_extra text[])` (alleen hoofdcoach, laatste hoofdcoach beschermd), `set_player_info(_team,_user,_jersey smallint,_position text)` (head/sc/basketball), `set_club_admin(_club,_user,_on)`, `join_team(_code)` (invite met `staff_kind='admin'` maakt clubbeheerder zonder teamlidmaatschap), `create_team`, `create_team_in_club` (alleen bestaande hoofdcoach), `remove_member`, `delete_my_account`, `set_my_consent`, `record_parent_consent`.
- Ouder: `create_parent_invite(_team,_child) -> code`, `join_as_parent(_code) -> child uuid` (eenmalig), `remove_parent_link`.
- Gym/kiosk: `save_workout`, `finish_workout_run(_run,_duration_min,_rpe)` (geen tweede afronding; geen geannuleerde/uitgesloten sessie), `kiosk_verify`, `kiosk_locked_users`, `kiosk_release_pin`, `set_athlete_pin`, `clear_athlete_pin`, `has_athlete_pin` (hash nooit leesbaar).
- Triggers bewaken: `session_logs` en `workout_runs` alleen voor atleten van het team, niet voor geannuleerde/uitgesloten sessies; `run_sets` alleen oefeningen uit de workout; audit-kolommen `logged_via/logged_by` worden door de DB gezet.

## 4. Offline- en cachingafspraken
- Gymsets: `src/lib/sync-queue.ts` + `WorkoutRunner`. Een call die GOOIT (geen netwerk, 5xx) blijft in de wachtrij en wordt opnieuw geprobeerd (online-event, zichtbaar worden, elke 8 s); `{ok:false}` is een definitief antwoord en wordt weggelaten + gemeld. Eigen apparaat: wachtrij in localStorage per `userId:sessionId`; iPad-modus: alleen geheugen (pincode mag niet worden opgeslagen). Afronden wacht achter de sets.
- Service worker (`public/sw.js`, v2): alleen `/_next/static/*` (cache-first) en `/icons/*`; navigaties via het netwerk met `offline.html` als fallback; HTML, RSC, API en niet-GET worden NOOIT gecachet.
- Verifieer offline-gedrag met `e2e/offline-runner.mjs` (7 scenario's, nagebootste server in `src/app/api/e2e`, alleen actief met `E2E_HARNESS=1`).

## 5. UI-contracten
- Alle zichtbare tekst via `t("area.key")`; NL en EN hebben identieke sleutels (compiler dwingt af). Nieuwe sleutels in het bestaande area-bestand onder `src/lib/i18n/messages`.
- Elk scherm heeft loading (loading.tsx), lege, succes- en foutstatus; foutgrens `error.tsx` bestaat voor `/` en `/team/[id]`.
- Mobiel eerst: 390px zonder horizontale scroll, tikdoelen >= 44px (iPad-modus >= 56px), focus-zichtbaar, labels voor invoer.
- Tokens en klassen: `src/app/globals.css` (`card`, `btn`, `btn-primary`, `chip`, `badge-*`, `eyebrow`, `num`, `display`, `.action-bar`); Bebas Neue heeft één gewicht (geen font-bold/extrabold op koppen).
- Gedeelde componenten (props niet stilzwijgend wijzigen): `Hero`, `Dial`, `Avatar`, `ConfirmButton`, `Hint`/`HintCard`, `QuickLog`, `RpePicker`, `TeamNav`, `AcademyBoard`.

## 6. Migraties
- Bestand per wijziging in `supabase/migrations/<jjjjmmdd>_<naam>.sql`, daarna toegepast door BACKEND via de Supabase MCP; elke nieuwe/gewijzigde functie of policy krijgt een rolled-back test (patroon in `supabase/tests/roles_matrix.sql`). Nooit data van gebruikers verwijderen zonder opdracht van LEAD/gebruiker.
