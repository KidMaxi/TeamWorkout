# Bewaartermijnen

**Let op: dit is een conservatief startpunt (concept). Laat het door een jurist / privacy officer beoordelen vóór gebruik. Termijnen zijn adviezen; de club (verwerkingsverantwoordelijke) besluit. Bewaren mag niet langer dan nodig voor het doel.**

## Schema (advies)
| Gegevenstype | Advies | Onderbouwing | Nu technisch afgedwongen? |
|---|---|---|---|
| Account (e-mail, naam, taal, voorwaarden) | Zolang account actief; verwijderen bij verzoek of na [12-24] maanden inactiviteit | Nodig voor toegang | Deels: gebruiker kan account verwijderen. Geen automatische inactiviteitsverwijdering. |
| Profiel (geboortedatum, lengte, gewicht) | Zolang lid; weg bij vertrek | Alleen nodig voor actief gebruik | Deels: verwijdering met account. Niet bij vertrek uit een team. [controleren] |
| Teamlidmaatschap | Zolang lid | Toegang | Ja, door team verlaten / lid verwijderen |
| Toestemmingsregistratie | Zolang verwerking loopt + [1-3] jaar (verantwoording) [jurist] | Bewijs rechtmatigheid | Verwijdering met account; geen aparte bewaring |
| Sessielogs (aanwezigheid, duur, RPE, load) | [24] maanden (2 seizoenen), daarna verwijderen of geaggregeerd | Trendanalyse over seizoenen | Deels: verwijderen bij team verlaten en account; geen automatische expiry |
| Wellness-check | [12] maanden | Gezondheidsgegevens: zo kort mogelijk | Deels: bij account/team verlaten; **geen automatische expiry** |
| Beschikbaarheidsnotities | Actueel + [6-12] maanden | Kunnen gezondheidsinfo bevatten | **Nee** |
| Krachttesten | [24] maanden | Voortgang over seizoenen | Deels (met account) |
| Weekbelastingslimieten | Zolang lid | Operationeel | Met account/team |
| Push-abonnementen | Tot uitschrijven; dode abonnementen direct | Alleen opt-in | Ja: dode abonnementen (404/410) worden automatisch verwijderd. Verlopen/inactieve niet. |
| Technische logs bij Vercel/Supabase | Volgens providerinstelling [controleren, vaak dagen tot weken] | Beveiliging | Provider-afhankelijk |
| Back-ups | [DAGEN, controleren bij Supabase-plan] | Herstel | Provider-afhankelijk; verwijderde gegevens blijven tot back-up verloopt |

## Wat wel en niet werkt (eerlijk)
- Werkt: account verwijderen (profiel en eigen data; geweigerd als enige staf van team met andere leden), team verlaten (eigen logs in dat team), toestemming intrekken, dode push-abonnementen.
- **Gaten**: geen automatische expiry van logs, wellness, notities, krachttesten; geen verwijdering van inactieve accounts; geen verwijderde-data-in-back-ups beleid; geen verwijdering van data van een vertrokken club na einde contract als geautomatiseerde procedure.

## Voorgestelde implementatie (nog niet gebouwd)
1. Geplande job (Supabase `pg_cron` of een extra Vercel Cron-route met service role key) die dagelijks verwijdert: wellness ouder dan [12] mnd; sessielogs en krachttesten ouder dan [24] mnd; beschikbaarheidsnotities ouder dan [12] mnd (of leegmaken).
2. Inactiviteitsmelding en verwijdering van accounts na [24] maanden zonder login, met voorafgaande e-mail.
3. Per-club instelbare bewaartermijn waar nodig.
4. Aantal verwijderde rijen loggen (zonder inhoud) als bewijs.
5. Bij einde contract: export + verwijdering per club als script/procedure.
6. Back-upretentie vastleggen en in privacytekst vermelden.

Tot dit gebouwd is: handmatige jaarlijkse opschoning door [WIE] en vermelding in het register.

Besluit club: [CLUB] stelt vast op [DATUM] door [NAAM].
