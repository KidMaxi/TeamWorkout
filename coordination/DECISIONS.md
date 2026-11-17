# DECISIONS (LEAD). Nieuwste onderaan.

D-01 (2026-11) Coach beslist, app adviseert. Weekregels, drempels en beschikbaarheid worden door de trainer gezet; de app toont regels en waarschuwingen, geen medisch oordeel. Gevolg: geen automatische blokkades van spelers.
D-02 Load = RPE x minuten (sRPE). Ratio (ACWR) is standaard verborgen (team-instelling `show_ratio`). Gevolg: UI toont "Normaal/Hoog/Laag" i.p.v. ruwe ratio.
D-03 Rollen per teamlid: `staff_kind` (hoofd/basketbal/S&C/medisch) + `extra_kinds`; meerdere teams en functies per persoon toegestaan. Planning per eigen team; hoofdcoach is lid van elk team dat hij beheert.
D-04 Clubbeheerder (`club_admins`): alleen lezen over de hele academy, NOOIT gezondheidsdetails (wellness, pijnreden, pincodes).
D-05 Gezondheidsdata alleen met toestemming van de atleet (minderjarigen: ouder via trainer vastgelegd). Fit-status: reden alleen zichtbaar voor staf van het team. Ouder ziet check-in van eigen kind alleen als kind toestemming gaf en < 18 is.
D-06 Leaderboard aan; spelers < 16 (of zonder geboortedatum) staan er niet op en zien het niet.
D-07 Trainer vult rugnummer en positie van spelers in (niet de speler zelf).
D-08 Ouderrol: alleen lezen, uitnodiging via eenmalige code per kind, door een trainer van het team gemaakt.
D-09 Productnaam Courtload; look gelijk aan de Lovable-demo (donker, oranje accent, Bebas Neue/Barlow, 6px hoeken).
D-10 Eenvoud boven volledigheid: eerste blik per scherm simpel, details een tik dieper; geen mogelijkheden verwijderd.
D-11 Offline: alleen gymsets loggen werkt offline (wachtrij; start en afronden vragen verbinding of worden uitgesteld). Rest vereist verbinding. Service worker cachet nooit HTML of data.
D-12 Server-side auth in middleware via `getClaims()` (lokale JWT-verificatie bij asymmetrische sleutels). Gevolg: een server-side ingetrokken sessie blijft geldig tot het token verloopt.
D-13 Er is geen `main`; productie is `claude/optimistic-hamilton-ngxqoa`. LEAD introduceert `integration/courtload`; niets gaat naar productie zonder expliciete opdracht van de gebruiker. (2026-11-17)
D-14 Samenwerking tussen sessies via Git-branches `coord/<ROLE>` en scripts in `tools/coord`, omdat cloudsessies geen bestandssysteem delen. (2026-11-17)
D-15 Database-wijzigingen worden uitsluitend door BACKEND uitgevoerd (live gedeelde DB); elke migratie krijgt een bestand in supabase/migrations en een rolled-back test. (2026-11-17)
