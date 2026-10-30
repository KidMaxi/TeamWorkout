# Sub-verwerkers

**Let op: conservatief startpunt (concept). Laat dit beoordelen door een jurist / privacy officer vóór gebruik. Gegevens over providers zijn niet geverifieerd; controleer overal de actuele voorwaarden ([controleer actuele voorwaarden]).**

Door [NAAM EXPLOITANT] ingeschakelde sub-verwerkers voor gegevens van clubs. Laatst bijgewerkt: [DATUM].

| Sub-verwerker | Doel | Gegevens | Locatie | Doorgiftegrond [verifiëren] | DPA / privacyinfo |
|---|---|---|---|---|---|
| Supabase | Database (Postgres), authenticatie, opslag van alle appgegevens | Account, profiel, teamlidmaatschap, toestemming, sessies, logs, wellness, beschikbaarheid, krachttesten, push-abonnementen | Regio Frankfurt (eu-central-1). Controleer of het moederbedrijf/ondersteuning buiten de EER toegang kan hebben [controleer actuele voorwaarden] | [bijv. EU-VS Data Privacy Framework en/of standaardcontractbepalingen - controleren] | [LINK DPA] [LINK SUB-VERWERKERS] |
| Vercel | Hosting en serverless functies (incl. dagelijkse cron voor herinneringen), cloudlogs, Web Analytics en Speed Insights (cookieloos) | Verzoek-metadata (IP, user agent), technische logs, geaggregeerde statistieken; tijdens verwerking passeren appgegevens de serverless functies | Functieregio: [CONTROLEREN in Vercel-projectinstellingen]; Vercel is een VS-bedrijf | [bijv. Data Privacy Framework en/of SCC - controleren] | [LINK DPA] [LINK SUB-VERWERKERS] |
| Pushdiensten van browsers/platformen (o.a. Google FCM, Mozilla, Apple), alleen als pushmeldingen aan staan en de gebruiker opt-in heeft gedaan | Bezorgen van webpush | Push-endpoint en versleutelde melding (titel/tekst zonder gezondheidsdetails [controleren in `src/app/api/cron/reminders/route.ts`]) | Wereldwijd, buiten de EER mogelijk | [controleren; dit zijn meestal eigen verwerkingsverantwoordelijken van de browser/OS-aanbieder] | [LINKS] |

Niet gebruikt volgens de repository: aparte e-maildienst, externe foutmonitoring, advertentie- of trackingdiensten. Controleer dit vóór elke update van deze lijst.

## Wijzigingsprocedure
1. Exploitant stelt een wijziging voor (nieuwe sub-verwerker of vervanging) en toetst: noodzaak, locatie, DPA, doorgiftegrond, beveiliging.
2. Exploitant informeert alle clubs schriftelijk (e-mail naar [CONTACT CLUB]) minimaal [30] dagen vooraf, met naam, doel, locatie en gegevens.
3. Club kan binnen [14] dagen gemotiveerd bezwaar maken. Bij bezwaar overleggen partijen; lukt dat niet, dan mag de club de overeenkomst beëindigen zonder boete [juridisch beoordelen].
4. Exploitant sluit met de nieuwe sub-verwerker een overeenkomst met dezelfde verplichtingen als in de verwerkersovereenkomst.
5. Werk deze lijst, Bijlage C van de verwerkersovereenkomst, het verwerkingsregister en de publieke privacytekst bij, met datum.

## Wijzigingslog
| Datum | Wijziging | Clubs geïnformeerd op | Bezwaren |
|---|---|---|---|
| [DATUM] | Eerste lijst | [DATUM] | - |
