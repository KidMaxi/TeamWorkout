# Juridische documenten TeamWorkout (operationeel)

**Let op: dit zijn conservatieve startpunten (concepten), geen juridisch advies. Laat elk document beoordelen door een jurist / privacy officer voordat het wordt gebruikt. Vul alle placeholders ([NAAM EXPLOITANT], [CLUB], [DATUM], ...) in. Niets in deze map is een bewijs dat overeenkomsten, certificeringen of maatregelen bestaan.**

Deze map bevat de documenten die de exploitant en de clubs rondom de app nodig hebben. De publieke teksten (privacy, voorwaarden, cookies) staan in de app zelf; de bedrijfsgegevens daarvoor staan in `src/lib/legal.ts` (nu leeg, `reviewed: false`).

## Rollen in het kort
- **Club** (teamorganisatie) = verwerkingsverantwoordelijke voor atleet- en teamgegevens.
- **Exploitant** = verwerker voor die gegevens; verwerkingsverantwoordelijke voor account/login, beveiliging en anonieme gebruiksstatistieken.
- **Sub-verwerkers**: Supabase (database + auth, regio Frankfurt eu-central-1), Vercel (hosting, cookieloze analytics en speed insights), pushdiensten van browsers als pushmeldingen aan staan.

## Index
| Document | Doel | Eigenaar |
|---|---|---|
| [verwerkersovereenkomst-sjabloon.md](verwerkersovereenkomst-sjabloon.md) | Art. 28 AVG-overeenkomst club - exploitant | Exploitant + club |
| [verwerkingsregister.md](verwerkingsregister.md) | Art. 30-register (verwerker en club) | Exploitant / club |
| [dpia-startpunt.md](dpia-startpunt.md) | DPIA-startdocument | Exploitant + club + jurist |
| [datalekprocedure.md](datalekprocedure.md) | Datalekken, 72-uurs melding | Exploitant + club |
| [bewaartermijnen.md](bewaartermijnen.md) | Bewaartermijnen en gaten | Club (besluit), exploitant (techniek) |
| [rechten-betrokkenen-procedure.md](rechten-betrokkenen-procedure.md) | Verzoeken van betrokkenen | Club, exploitant ondersteunt |
| [toestemmingsformulier-ouders.md](toestemmingsformulier-ouders.md) | Ouderlijke toestemming < 16 jaar | Club |
| [sub-verwerkers.md](sub-verwerkers.md) | Lijst en wijzigingsprocedure | Exploitant |

## Go-live checklist (op volgorde van prioriteit)
Verantwoordelijke: **E** = exploitant, **C** = club, **J** = jurist/privacy officer.

| # | Actie | Wie | Klaar |
|---|---|---|---|
| a | Vul de exploitantgegevens in `src/lib/legal.ts` (naam, adres, KvK, e-mail, privacy-e-mail). Zet `reviewed: true` pas ná juridische controle van de publieke teksten. | E, J | [ ] |
| b | Accepteer/onderteken de verwerkersovereenkomsten (DPA) van Supabase en Vercel; noteer hun sub-verwerkerslijsten en doorgiftemechanismen [controleer actuele voorwaarden]. Leg vast waar en wanneer. | E | [ ] |
| c | Sluit met elke club een verwerkersovereenkomst (sjabloon in deze map). Geen clubgegevens verwerken zonder getekende overeenkomst. | E, C, J | [ ] |
| d | Voer een DPIA uit vóór verwerking van gezondheidsgegevens van minderjarigen op schaal. Waarschijnlijk verplicht: bijzondere categorie (gezondheid), kwetsbare betrokkenen (minderjarigen), systematische monitoring van gedrag/belasting; de AP-lijst van verwerkingen waarvoor een DPIA verplicht is raakt hieraan [controleer actuele AP-lijst]. Startpunt: `dpia-startpunt.md`. | E, C, J | [ ] |
| e | Stel per club de procedure voor ouderlijke toestemming vast (< 16 jaar) en bewaar getekende formulieren; leg de toestemming ook vast in de app. | C | [ ] |
| f | Maak het verwerkingsregister (exploitant als verwerker; elke club als verwerkingsverantwoordelijke). | E, C | [ ] |
| g | Stel de datalekprocedure vast, wijs contactpersonen aan en maak het datalekregister aan. | E, C | [ ] |
| h | Besluit over bewaartermijnen en plan implementatie van automatische verwijdering (nu niet aanwezig). | C, E | [ ] |
| i | Zet MFA aan op Supabase-, Vercel- en GitHub-accounts; beperk toegang tot het Supabase-dashboard en de service role key tot het minimum; MFA voor appgebruikers (staf) is nu niet beschikbaar. | E | [ ] |
| j | Controleer de seed-oefenbibliotheek en alle publieke teksten (geen medische claims, geen onjuiste beloftes; load-ratio is een indicatie, geen blessurevoorspelling). | E, J | [ ] |
| k | Regel back-ups: controleer wat Supabase op het gekozen plan biedt (retentie, point-in-time recovery) [controleer actuele voorwaarden], test een restore en leg de back-upretentie vast. | E | [ ] |

## Eerlijke lijst van wat er (nog) niet is
Automatische verwijdering na bewaartermijn; auditlog van stafinzage; MFA voor appgebruikers; vastlegging van DPA-ondertekening in de app; een functionaris voor gegevensbescherming (FG/DPO) of andere aangewezen privacy-contactpersoon. Zie `dpia-startpunt.md` en `bewaartermijnen.md`.

*Versie: [VERSIE] / datum: [DATUM]*
