# DB-tests (supabase/tests)

Alle scripts zijn **rolled back**: elk eindigt met `raise exception 'RESULT ...'`, dus er blijft niets staan. Draaien: plak het hele bestand in de Supabase SQL-editor of in MCP `execute_sql` (project `xkbbgwndtcfnkifhmles`). De fout "P0001: RESULT ..." is het verwachte, geslaagde einde; vergelijk de tekst met het blok "Expected" in de kop van het script. Fixtures gebruiken eigen willekeurige uuid's en `@t.local`-adressen en raken de demo-data niet.

| Script | Dekt | Controle |
|---|---|---|
| roles_matrix.sql | rollen/RLS-matrix, set_staff_kinds, join_team, club-beheerder (schrijven geweigerd, geen gezondheidsdata) | kop |
| parent.sql | ouder: uitnodiging eenmalig, alleen-lezen, toestemming + minderjarig voor check-ins, remove_parent_link | kop |
| fit_status.sql | academy_fit_status: statusregels, toestemming, reden alleen voor staf | kop |
| leaderboard.sql | leaderboard_access, club_record_exercises, club_records (<16 / zonder geboortedatum nooit zichtbaar) | kop |
| week_matrix.sql | academy_week_matrix + athlete_week (geannuleerd/uitgesloten/afwezig tellen niet, avg_28d, toegang) | kop |
| session_set_summary.sql | session_set_summary (warm-up telt niet, wie ziet wat) | kop |
| set_player_info.sql | set_player_info (rechten, rugnummer uniek/bereik, positie) | kop |
| kiosk_pin_release.sql | kiosk_locked_users, kiosk_release_pin (alleen head/S&C), hash onleesbaar | kop |
| policy_write_split.sql | schrijfrechten van de policies die FOR ALL waren (availability, team_workload_settings, workouts) na B-03a | kop |

Opruimcontrole (na een run): `select count(*) from auth.users where email like '%@t.local'` en `... from public.clubs where name='TestClub'` moeten 0 zijn.

Let op: sommige uitkomsten bevatten tellers die binnen één run oplopen (roles_matrix: aantal sessies, omdat eerdere rollen succesvol inserten); de kop noemt wat telt.
