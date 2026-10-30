# Verwerkingsregister (art. 30 AVG)

**Let op: dit is een conservatief startpunt (concept). Laat het door een jurist / privacy officer beoordelen vóór gebruik. Bewaartermijnen zijn adviezen, geen besluiten; vul placeholders in. Het register moet actueel worden gehouden.**

## Deel 1: register van de exploitant als verwerker (art. 30 lid 2)

| Veld | Invulling |
|---|---|
| Verwerker | [NAAM EXPLOITANT], [ADRES], [KVK], contact [E-MAIL] |
| Verwerkingsverantwoordelijken (clubs) | [LIJST CLUBS; per club een regel met contact] |
| FG/DPO | [GEEN / NAAM] |
| Categorieën verwerking | Hosten en beschikbaar stellen van TeamWorkout voor sporters en staf van de club (Bijlage A van de verwerkersovereenkomst) |
| Doorgiften buiten EER | Vercel is een VS-bedrijf; pushdiensten wereldwijd. Grond: [controleren, zie `sub-verwerkers.md`] |
| Beveiligingsmaatregelen | Zie Bijlage B van de verwerkersovereenkomst |

## Deel 2: register van de club als verwerkingsverantwoordelijke (art. 30 lid 1), voorgevuld

Verwerkingsverantwoordelijke: [CLUB], [ADRES], contact [E-MAIL], FG: [GEEN / NAAM]. Verwerker: [NAAM EXPLOITANT]. Datum/versie: [DATUM].

| Activiteit | Doel | Categorieën gegevens | Betrokkenen | Ontvangers | Doorgiften | Bewaartermijn [advies] | Beveiliging |
|---|---|---|---|---|---|---|---|
| Account en inloggen | Toegang tot de app | E-mail, gehasht wachtwoord, naam, taal, acceptatie voorwaarden | Sporters, staf | Exploitant (verwerker), Supabase | Zie sub-verwerkers | Zolang account actief; verwijderen op verzoek of [12] maanden na laatste lidmaatschap | RLS, Supabase Auth, HTTPS |
| Profiel | Belasting en training individueel afstemmen | Geboortedatum, lengte, gewicht | Sporters | Eigen staf van de teams | Idem | Zolang lid; verwijderen bij vertrek | RLS |
| Teamlidmaatschap en toestemming | Toegang en rechtmatigheid | Rol, team, toestemmingsstatus, ouderlijke toestemming met notitie | Sporters, staf | Staf van het team | Idem | Toestemmingsbewijs: zolang de verwerking loopt + [1-3] jaar als verantwoording [juridisch beoordelen]; getekend formulier door club | RLS |
| Trainingsplanning en logs | Belasting monitoren (acute/chronische load) | Sessies, aanwezigheid, duur, RPE, load | Sporters | Staf van het team | Idem | [24] maanden of 2 seizoenen | RLS |
| Beschikbaarheid | Plannen en veilig belasten | Status, notitie van staf (kan gezondheid bevatten) | Sporters | Staf van het team | Idem | Actueel + [6-12] maanden | RLS; notitie beperkt houden |
| Weekbelastingslimieten | Belasting begrenzen | Limiet per sporter | Sporters | Staf | Idem | Zolang lid | RLS |
| Dagelijkse wellness-check | Welzijn en herstel signaleren | Slaap, spierpijn, energie, rust, stemming (gezondheid, bijzonder) | Sporters, ook minderjarigen | Staf alleen met geregistreerde toestemming | Idem | [12] maanden | RLS + toestemmingscheck; DPIA vereist |
| Krachttesten | Krachtontwikkeling volgen | 5RM per oefening | Sporters | Staf, sporter zelf | Idem | [24] maanden | RLS |
| Oefenbibliotheek | Trainingen opstellen | Oefeningen per club | Staf | Staf | Idem | Zolang club actief | RLS |
| Pushmeldingen (optioneel) | Herinneringen | Endpoint, sleutels, user agent | Gebruikers met opt-in | Pushdienst van browser/OS | Mogelijk buiten EER | Tot uitschrijven of dode abonnementen (automatisch) | CRON_SECRET, opt-in |
| Technische logs en statistieken | Beveiliging, werking | IP, user agent, tijdstip; cookieloze statistieken | Alle gebruikers | Vercel, Supabase | Zie sub-verwerkers | Volgens providerinstellingen [controleren] | Provider |

Rechtsgrond per activiteit: [INVULLEN DOOR CLUB/JURIST; wellness: uitdrukkelijke toestemming art. 9 lid 2 sub a, bij < 16 jaar ouderlijke toestemming]. Overige: [gerechtvaardigd belang / uitvoering overeenkomst - beoordelen].
