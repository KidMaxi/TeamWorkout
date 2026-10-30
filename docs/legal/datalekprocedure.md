# Datalekprocedure

**Let op: dit is een conservatief startpunt (concept). Laat het door een jurist / privacy officer beoordelen vóór gebruik. Vul de contactgegevens in en oefen de procedure.**

Een datalek is elke inbreuk op beveiliging die leidt tot vernietiging, verlies, wijziging of ongeoorloofde verstrekking van of toegang tot persoonsgegevens (art. 4 lid 12 AVG). Bij TeamWorkout zijn gezondheidsgegevens van minderjarigen in het geding: reken op strenge beoordeling.

## Rollen en termijnen
- **Exploitant (verwerker)** meldt een lek aan de betreffende club(s) **zonder onredelijke vertraging, doel [24/48] uur** na ontdekking.
- **Club (verwerkingsverantwoordelijke)** beoordeelt en meldt aan de Autoriteit Persoonsgegevens **binnen 72 uur nadat de club er kennis van heeft genomen**, tenzij het lek waarschijnlijk geen risico voor de rechten en vrijheden van personen oplevert.
- **Betrokkenen** (of ouders bij minderjarigen) worden zonder onredelijke vertraging geïnformeerd bij waarschijnlijk **hoog risico**.
- Elk lek, ook zonder melding, wordt gedocumenteerd.

## Stappen
1. **Ontdekken**: signaal van gebruiker, provider, monitoring, eigen waarneming. Noteer tijdstip en melder. Eén aanspreekpunt: [NAAM EXPLOITANT CONTACT].
2. **Beperken** (direct, zie hieronder voor deze stack).
3. **Vaststellen**: wat, wanneer, welke gegevens, hoeveel personen, welke clubs, nog gaande? Bewaar logs als bewijs voordat ze verlopen.
4. **Beoordelen risico**: gaat het om gezondheidsgegevens, minderjarigen, identificeerbaarheid, omvang, ontvanger bekend/vertrouwd, omkeerbaarheid? Gezondheidsgegevens van minderjarigen zijn meestal minimaal "risico", vaak "hoog risico" bij openbaarwording.
5. **Melden aan club(s)**: met aard, categorieën, aantallen, gevolgen, maatregelen, contact. Aanvullende info later nasturen.
6. **Club meldt aan AP** via het meldloket datalekken [controleer actuele AP-procedure] binnen 72 uur.
7. **Betrokkenen informeren** bij hoog risico: begrijpelijk, wat gebeurd is, welke gegevens, wat te doen, contact. Bij < 16 jaar de ouders en/of de minderjarige, in leeftijdsgeschikte taal.
8. **Herstellen en leren**: oorzaak wegnemen, evaluatie binnen [14] dagen, maatregelen in DPIA/register bijwerken.

## Eerste hulp voor deze stack
- [ ] Bepaal of de **Supabase publishable key**, **service role key** of **VAPID private key** of **CRON_SECRET** is gelekt; roteer wat geraakt kan zijn (Supabase dashboard > Project Settings > API; daarna Vercel-omgevingsvariabelen bijwerken en opnieuw deployen).
- [ ] **Sessies intrekken**: laat gebruikers uitloggen / beëindig sessies in Supabase Auth bij verdenking van accountovername; reset wachtwoorden van getroffen accounts. Roteer indien nodig de JWT-secret [let op: dit logt iedereen uit].
- [ ] **Push-cron uitzetten**: verwijder `CRON_SECRET` of de cron in `vercel.json`, of pauzeer; roteer VAPID-sleutels (bestaande abonnementen vervallen).
- [ ] **Logs**: Vercel (runtime logs, deployments) en Supabase (Auth-, API- en Postgres-logs) bekijken en exporteren: wie, welke endpoints, welke periode.
- [ ] **RLS controleren**: onbedoelde publieke tabellen of beleid; Supabase advisors draaien.
- [ ] Verdachte deployment terugdraaien (Vercel rollback); toegang van teamleden/GitHub tokens intrekken.
- [ ] Zet beheeraccounts op MFA en wijzig hun wachtwoorden.
- [ ] Back-ups niet overschrijven voordat onderzoek klaar is, indien relevant.

## Contactblad (invullen)
| Rol | Naam | Telefoon | E-mail |
|---|---|---|---|
| Exploitant incidentcontact | [NAAM] | [TEL] | [E-MAIL] |
| Reserve exploitant | [NAAM] | [TEL] | [E-MAIL] |
| Per club: privacy-contact | [NAAM] | [TEL] | [E-MAIL] |
| Jurist / privacy officer | [NAAM] | [TEL] | [E-MAIL] |
| Supabase support | - | - | [via dashboard / controleren] |
| Vercel support | - | - | [via dashboard / controleren] |
| Autoriteit Persoonsgegevens | meldloket datalekken | [controleren] | [controleren] |

## Datalekregister (sjabloon)
| Nr | Ontdekt (datum/tijd) | Gemeld door | Beschrijving | Gegevens en aantallen | Clubs | Risico (laag/midden/hoog) + onderbouwing | Club geïnformeerd op | AP gemeld op (of reden niet) | Betrokkenen geïnformeerd | Maatregelen | Afgesloten |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | | | |
