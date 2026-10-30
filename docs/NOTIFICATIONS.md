# Pushmeldingen (herinneringen)

## Wat het doet
Opt-in webpush via de profielpagina. Eén keer per dag draait een cron-job (`/api/cron/reminders`):

- **Atleten**: één melding als er sessies van de laatste 3 dagen zijn zonder RPE en/of de wellness-check van vandaag ontbreekt (gecombineerd in één melding).
- **Staf**: één melding per dag ('N spelers hebben een hoge belasting'), met dezelfde regels als `team_load_overview` (ACWR > 1,5 of acute belasting boven het weeklimiet; niet-beschikbare spelers tellen niet mee).
- Dode abonnementen (404/410) worden automatisch verwijderd. Teksten volgen de taal van het profiel.

Zolang de variabelen hieronder ontbreken blijft alles inactief: de kaart op het profiel is verborgen en de cron-route geeft 401/503.

## Omgevingsvariabelen
| Variabele | Bron |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `npx web-push generate-vapid-keys` (public key) |
| `VAPID_PRIVATE_KEY` | zelfde commando (private key, geheim) |
| `VAPID_SUBJECT` | bijv. `mailto:jij@voorbeeld.nl` |
| `CRON_SECRET` | een willekeurige lange string (bijv. `openssl rand -hex 32`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard > Project Settings > API > `service_role` |

Let op: de service role key omzeilt alle RLS-regels. Commit hem nooit, zet hem niet in een `NEXT_PUBLIC_`-variabele en deel hem niet.

## Instellen in Vercel
Project > Settings > Environment Variables: voeg de vijf variabelen toe (Production), en deploy daarna opnieuw (Redeploy). Vercel Cron stuurt `Authorization: Bearer <CRON_SECRET>` automatisch mee.

## iOS
Meldingen werken op iPhone/iPad alleen als de app op het beginscherm staat (Deel-icoon > 'Zet op beginscherm') en vanaf iOS 16.4.

## Beperkingen
- Vercel Hobby staat één cron-run per dag toe; `vercel.json` plant 16:00 UTC (`0 16 * * *`).
- Niet gebouwd: tijden per gebruiker, stille uren, meldingen per team of per type uitzetten.

## Handmatig testen
```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" https://<jouw-domein>/api/cron/reminders
```
Antwoord: `{"athletes":..,"staff":..,"sent":..,"removed":..}`. Zonder of met een fout secret volgt 401; zonder (alle) variabelen 503. Elke aanroep verstuurt echt meldingen.
