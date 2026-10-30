# DPIA - startpunt

**Let op: dit is een conservatief startpunt (concept), geen afgeronde DPIA. Laat het door een jurist / privacy officer beoordelen en aanvullen. De club is verantwoordelijk voor de DPIA; de exploitant levert input. Raadpleeg [controleer actuele AP-lijst en AP-richtsnoeren]. Niets hier bewijst dat maatregelen bestaan buiten wat de repository toont.**

Opgesteld door: [NAAM] | Datum: [DATUM] | Versie: [VERSIE] | Club: [CLUB] | Verwerker: [NAAM EXPLOITANT]

## 1. Waarom een DPIA
Gezondheidsgegevens (wellness, beschikbaarheid/blessure), kwetsbare betrokkenen (minderjarigen 14-19), en systematische monitoring van belasting en welzijn over tijd. Meerdere criteria uit de AP-lijst/EDPB-criteria zijn waarschijnlijk van toepassing. Conservatieve conclusie: DPIA uitvoeren vóór verwerking op schaal.

## 2. Beschrijving van de verwerking
- **Aard**: PWA waarin sporters trainingen loggen (aanwezigheid, duur, RPE), dagelijks wellness invullen, krachtresultaten bijhouden; staf plant, ziet load-ratio's en beschikbaarheid.
- **Gegevens**: zie `verwerkingsregister.md`. Hosting: Supabase (Frankfurt), Vercel.
- **Doelen**: belasting verstandig sturen, welzijn signaleren. Niet: selectiebeslissingen automatiseren of medische diagnoses stellen.
- **Beslissingen**: geen geautomatiseerde besluitvorming met rechtsgevolg; ratio's zijn indicaties.
- **Toegang**: sporter eigen data; staf van het team; wellness alleen met geregistreerde toestemming; exploitant technisch toegang tot database.

## 3. Noodzaak en proportionaliteit
| Vraag | Beoordeling [INVULLEN] |
|---|---|
| Is het doel gerechtvaardigd en gespecificeerd? | Ja, belastingbeheer en welzijn |
| Rechtsgrond (art. 6 en art. 9)? | Toestemming; <16 via ouders. Vrijwilligheid: deelname mag niet afhangen van wellness. |
| Dataminimalisatie? | Alleen 5 wellness-items (1-5), geen vrije tekst voor sporters; staf-notitie bij beschikbaarheid is vrije tekst (risico). Geboortedatum nodig voor leeftijdscontrole; lengte/gewicht: noodzaak toetsen [club]. |
| Bewaartermijn? | Nog niet technisch afgedwongen, zie `bewaartermijnen.md` |
| Informatie aan betrokkenen? | Publieke privacytekst in app + `toestemmingsformulier-ouders.md` |
| Rechten? | In-app export, verwijdering, toestemming intrekken |
| Verwerkers? | Supabase, Vercel; DPA's [te sluiten/controleren] |
| Doorgifte buiten EER? | Zie `sub-verwerkers.md` |

## 4. Risicoanalyse
Schaal: kans (L/M/H) x impact (L/M/H). Beoordeling hieronder is een eerste inschatting [te valideren].

| # | Risico | Kans | Impact | Aanwezig | Ontbreekt of te doen |
|---|---|---|---|---|---|
| 1 | Vertrouwelijkheid gezondheidsgegevens van minderjarigen (lek, verkeerde ontvanger) | M | H | RLS, toestemming als voorwaarde voor staf-inzage, HTTPS | Auditlog, MFA, jaarlijkse toegangsreview, pentest |
| 2 | Onbevoegde stafinzage (staf kijkt zonder noodzaak, of na vertrek van club) | M | H | Staf alleen eigen teams; wellness alleen met toestemming | Auditlog van inzage, procedure voor stafwijzigingen, gedragsregels staf |
| 3 | Overmatige gegevensverzameling (lengte/gewicht, vrije notities met medische info) | M | M | Beperkt aantal velden | Richtlijn voor notities, review noodzaak lengte/gewicht |
| 4 | Pushmeldingen: endpoints/sleutels gelekt of inhoud zichtbaar op vergrendeld scherm | L | M | Opt-in, dode abonnementen verwijderd, cron-secret | Controle dat meldingen geen details bevatten; service role key beheer |
| 5 | Datalek (misconfiguratie RLS, gelekte service role key, gecompromitteerd account) | L-M | H | RLS, secrets niet in NEXT_PUBLIC | `datalekprocedure.md` vaststellen, MFA, key rotation-oefening, back-up/restore test |
| 6 | Misinterpretatie van ratio's/wellness als medisch advies of onterechte selectie-/speeltijdbeslissingen | M | M | Uitleg dat ratio indicatie is | Duidelijke disclaimer in app en voor staf, trainingsrichtlijn club |
| 7 | Gaten in ouderlijke toestemming (niet geldig, niet bewaard, verlopen bij 16e verjaardag, intrekking niet verwerkt) | M | H | Toestemming vastleggen in app (nota bene: verifiëren) | Procedure per club, bewijs, hertoestemming op 16, check dat intrekking staf-inzage direct blokkeert |
| 8 | Drang/druk: sporters voelen zich verplicht wellness in te vullen of toestemming te geven | M | M | - | Duidelijke vrijwilligheid zonder gevolgen, communicatie door club |
| 9 | Bewaring te lang (geen automatische verwijdering) | H | M | Handmatige verwijdering bij account/team verlaten | Geplande purge, zie `bewaartermijnen.md` |
| 10 | Gegevens blijven na vertrek club of einde contract | M | M | - | Teruggave/verwijdering in verwerkersovereenkomst, uitvoeringsprocedure |

## 5. Maatregelen: aanwezig versus ontbrekend
**Aanwezig**: RLS, toestemmingsafhankelijke wellness-zichtbaarheid, in-app export/verwijdering/vertrek/intrekking, EU-regio database, cookieloze analytics, CRON_SECRET, geen data-caching in service worker.
**Ontbrekend**: automatische bewaartermijnen, auditlog, MFA voor appgebruikers, in-app DPA-registratie, FG/privacy-contactpersoon, geteste back-ups, getest incidentproces, onafhankelijke beveiligingstoets.

## 6. Restrisico en besluit
| Onderwerp | Invulling |
|---|---|
| Restrisico na huidige maatregelen | [LAAG / MIDDEN / HOOG - INVULLEN] |
| Aanvullende maatregelen + eigenaar + deadline | [TABEL INVULLEN] |
| Advies FG/privacy officer | [INVULLEN / N.V.T.] |
| Standpunt betrokkenen/ouders (art. 35 lid 9, waar passend) | [INVULLEN] |
| Hoog restrisico? Dan voorafgaande raadpleging AP (art. 36) | [JA/NEE] |
| Besluit verwerkingsverantwoordelijke | [GO / GO MET VOORWAARDEN / NO-GO], door [NAAM], op [DATUM] |
| Herbeoordeling | [DATUM, minimaal jaarlijks of bij wijziging] |
