# TeamWorkout

PWA voor het bijhouden van trainingsload (academy, gym, avondtraining, wedstrijd) per team.
Next.js 15, Supabase (EU, Frankfurt), bedoeld voor Vercel.

## Wat zit erin (MVP)
- Login, rollen per team (staf/atleet), uitnodigingscodes, toestemmingsvlag per atleet
- Staf plant trainingen; atleten loggen aanwezigheid, minuten en RPE (load = RPE x minuten)
- Stafdashboard: acute load (7d), chronische weekload (28d), ratio, beschikbaarheid, limiet per atleet
- Ratio verschijnt pas na 28 dagen data en is een indicatie, geen blessurevoorspelling

Niet gebouwd: wellness-check, ouderaccounts, notificaties, offline-modus.

## Draaien
```bash
cp .env.example .env.local   # vul de publishable key in
npm install
npm run dev
```

De database staat in Supabase-project `teamworkout` (`xkbbgwndtcfnkifhmles`). Rechten lopen via row-level security;
staf ziet alleen eigen teams, atleten alleen hun eigen logs.
