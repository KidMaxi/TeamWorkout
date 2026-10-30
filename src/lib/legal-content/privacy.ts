import { opName, operatorList, privMail } from "./shared";
import type { LegalContent } from "./shared";
import { LEGAL } from "@/lib/legal";

const V = LEGAL.termsVersion;

export const content: LegalContent = {
  nl: {
    title: "Privacyverklaring",
    intro:
      "TeamWorkout helpt sportteams om trainingsbelasting te plannen en te volgen. Hieronder leggen we in gewone taal uit welke gegevens we verwerken, waarom, wie ze ziet en welke rechten je hebt. Gaat het om gegevens van minderjarigen of om gezondheidsgegevens, dan lees je daar extra uitleg over.",
    sections: [
      {
        id: "roles",
        title: "Wie is waarvoor verantwoordelijk?",
        body: [
          "De club (de teamorganisatie) bepaalt waarom en hoe gegevens van sporters worden verwerkt. Voor teamgegevens (trainingen, beschikbaarheid, wellnessvragen en krachttests) is de club de verwerkingsverantwoordelijke.",
          `De beheerder van deze app (${opName()}) is voor die teamgegevens verwerker: hij verwerkt ze alleen namens de club en volgens haar instructies. Clubs sluiten daarvoor een verwerkersovereenkomst met de beheerder. Of dat voor jouw club al is gebeurd, vraag je aan je club.`,
          "De beheerder is zelf verwerkingsverantwoordelijke voor accountgegevens (inloggen), voor beveiliging en voor anonieme statistieken over het gebruik van de dienst.",
        ],
      },
      {
        id: "data",
        title: "Welke gegevens verwerken we?",
        body: [
          "We verwerken alleen gegevens die nodig zijn voor de functies van de app.",
          {
            table: {
              head: ["Categorie", "Voorbeelden", "Doel", "Grondslag"],
              rows: [
                ["Account", "E-mailadres, wachtwoord (alleen als hash bij de inlogdienst), volledige naam, taal, akkoord op voorwaarden met versie en datum", "Inloggen, het account beheren, aantonen dat voorwaarden zijn geaccepteerd", "Uitvoering van de overeenkomst (art. 6 lid 1 sub b AVG)"],
                ["Profiel", "Geboortedatum, lengte (cm), gewicht (kg)", "Leeftijdsgrenzen toepassen en gewichten en belasting berekenen", "Uitdrukkelijke toestemming (art. 9 lid 2 sub a AVG), zie hieronder"],
                ["Teamlidmaatschap", "Team, rol (staf of sporter), toestemmingsstatus, wie die gaf, wanneer, en een notitie bij toestemming van een ouder of voogd", "Toegang per team regelen en toestemming vastleggen", "Uitvoering van de overeenkomst; de club moet toestemming kunnen aantonen"],
                ["Training", "Geplande sessies, aanwezigheid, duur, RPE, berekende belasting, weeklimieten door de staf", "Trainingsbelasting plannen en volgen", "Uitvoering van de overeenkomst"],
                ["Beschikbaarheid", "Beschikbaar, beperkt of niet beschikbaar, plus een notitie van de staf die blessure of ziekte kan onthullen", "Training afstemmen op wie kan meedoen", "Uitdrukkelijke toestemming (gezondheidsgegevens)"],
                ["Wellnesscheck", "Slaap, spierpijn, energie, rust en stemming op schalen van 1 tot 5", "Vroeg signaleren van vermoeidheid of overbelasting", "Uitdrukkelijke toestemming (gezondheidsgegevens)"],
                ["Kracht", "5RM-tests: oefening, gewicht, herhalingen, RPE, datum, notitie", "Trainingsgewichten berekenen en voortgang volgen", "Uitvoering van de overeenkomst; toestemming voor zover het gezondheidsgegevens zijn"],
                ["Pushmeldingen", "Push-adres en sleutels van je browser, user agent, herinneringsvoorkeur (alleen als je meldingen aanzet)", "Herinneringen sturen", "Toestemming (je geeft die via de browser)"],
                ["Technisch", "IP-adres en serverlogs bij hosting- en databaseaanbieders; cookieloze anonieme gebruiks- en prestatiestatistieken", "Beveiliging, storingen oplossen, de dienst verbeteren", "Gerechtvaardigd belang (art. 6 lid 1 sub f AVG)"],
              ],
            },
          },
        ],
      },
      {
        id: "health",
        title: "Gezondheidsgegevens",
        body: [
          "Notities bij beschikbaarheid, de wellnesscheck, informatie over blessures en lichaamsmetingen behandelen we als gezondheidsgegevens. Dat zijn bijzondere persoonsgegevens (art. 9 AVG). We verwerken ze alleen met je uitdrukkelijke toestemming (art. 9 lid 2 sub a AVG).",
          {
            list: [
              "Sporters van 16 jaar of ouder geven die toestemming zelf, per team, in hun profiel. Je kunt haar daar ook weer intrekken.",
              "Voor sporters onder de 16 jaar moet een ouder of voogd toestemming geven. De club legt dat vast in de app.",
              "De staf ziet de wellnessantwoorden van een sporter alleen als de toestemming is vastgelegd.",
              "Trek je de toestemming in, dan zijn die antwoorden direct weer verborgen voor de staf. Wat eerder gebeurde, blijft rechtmatig.",
            ],
          },
          "Voor accountgegevens en de kernfuncties gebruiken we uitvoering van de overeenkomst (art. 6 lid 1 sub b) als grondslag. Voor beveiliging en anonieme statistieken is dat gerechtvaardigd belang (art. 6 lid 1 sub f). Voor pushmeldingen is het je toestemming via de browser.",
        ],
      },
      {
        id: "access",
        title: "Wie ziet wat?",
        body: [
          {
            list: [
              "Sporters zien alleen hun eigen gegevens. De acute:chronic-verhouding (belastingsratio) zien sporters niet.",
              "De staf van een team ziet de trainings- en beschikbaarheidsgegevens van dat team. Wellnessantwoorden zien ze alleen met vastgelegde toestemming.",
              "Staf van andere clubs of teams ziet niets.",
              "Medewerkers van de beheerder hebben alleen toegang voor ondersteuning of beveiliging, onder geheimhouding.",
            ],
          },
          "We verkopen geen gegevens, tonen geen advertenties en maken geen profielen met rechtsgevolgen. Belastingsratio's en signalen zijn hulpmiddelen voor de staf. Het zijn geen geautomatiseerde besluiten in de zin van art. 22 AVG: een mens beslist.",
        ],
      },
      {
        id: "processors",
        title: "Verwerkers en doorgifte",
        body: [
          "We schakelen de volgende partijen in. Met hen gelden afspraken over het veilig verwerken van gegevens.",
          {
            table: {
              head: ["Partij", "Waarvoor", "Waar"],
              rows: [
                ["Supabase", "Database en inloggen (authenticatie), inclusief het versturen van account-e-mails via de inlogdienst", "Projecthosting in de EU (Frankfurt)"],
                ["Vercel", "Hosting en levering van de website, webstatistieken (Web Analytics) en prestatiemetingen (Speed Insights)", "Vercel is een Amerikaans bedrijf. Doorgifte buiten de EER steunt op een adequaatheidsbesluit of standaardcontractbepalingen volgens de verwerkersovereenkomst van Vercel. [bevestig dit tegen de actuele Vercel-DPA]"],
                ["Push-diensten van browsers (Google, Apple, Mozilla, Microsoft)", "Pushmeldingen afleveren, alleen als je meldingen aanzet", "Afhankelijk van je browser"],
              ],
            },
          },
          "De lettertypen worden bij het bouwen van de app zelf gehost. Je browser vraagt dus tijdens het gebruik geen lettertypen op bij Google Fonts.",
        ],
      },
      {
        id: "retention",
        title: "Hoe lang bewaren we gegevens?",
        body: [
          {
            list: [
              "Account- en teamgegevens bewaren we tot je je account verwijdert of het team verlaat. Verlaat je een team, dan verdwijnen je logs in dat team.",
              "Verwijder je je account, dan verwijderen we je profiel, logs, wellnessantwoorden, krachttests en pushinstellingen.",
              "Back-ups bij de aanbieder verlopen volgens zijn eigen schema. [bevestig de bewaartermijn van back-ups]",
              "Technische logs bewaart de betreffende aanbieder volgens zijn eigen termijnen.",
            ],
          },
          "Onze aanbeveling aan clubs is om wellnessgegevens niet langer te bewaren dan nodig, bijvoorbeeld maximaal 12 maanden. Dat is een advies; de app dwingt het niet af.",
        ],
      },
      {
        id: "rights",
        title: "Jouw rechten",
        body: [
          "Je hebt het recht op inzage, correctie, verwijdering, beperking van de verwerking, overdraagbaarheid en bezwaar. Je kunt gegeven toestemming altijd intrekken. Je hoeft je niet te laten onderwerpen aan een besluit dat uitsluitend geautomatiseerd is genomen.",
          {
            list: [
              "In de app, op je profielpagina: gegevens exporteren (JSON), je profiel aanpassen, toestemming intrekken en je account verwijderen.",
              `Voor andere verzoeken mail je ${privMail()}. We reageren binnen één maand.`,
              "Gaat het om teamgegevens, dan kun je ook contact opnemen met je club.",
              "Ben je het niet eens met hoe we met je gegevens omgaan? Dan kun je een klacht indienen bij de Autoriteit Persoonsgegevens (autoriteitpersoonsgegevens.nl).",
            ],
          },
        ],
      },
      {
        id: "minors",
        title: "Kinderen en minderjarigen",
        body: [
          "In Nederland ligt de leeftijd voor eigen toestemming op 16 jaar. Voor sporters onder de 16 is toestemming van een ouder of voogd nodig voor gezondheidsgegevens.",
          "De club is verantwoordelijk voor het verkrijgen en bewaren van het bewijs van die ouderlijke toestemming. De app legt die toestemming alleen vast. Accounts van minderjarigen worden gebruikt binnen een club.",
        ],
      },
      {
        id: "security",
        title: "Beveiliging",
        body: [
          {
            list: [
              "Verbindingen zijn versleuteld met TLS.",
              "De database staat in de EU.",
              "Toegang is per rij geregeld (row level security), zodat gebruikers alleen bij gegevens komen waar ze recht op hebben.",
              "Rollen bepalen wat staf en sporters kunnen doen.",
              "Wachtwoorden worden als hash opgeslagen door de inlogdienst.",
              "Toegang door medewerkers van de beheerder is beperkt.",
            ],
          },
          "Bij een datalek informeren we de club als verwerkingsverantwoordelijke zonder onredelijke vertraging. Waar nodig melden we het ook bij de Autoriteit Persoonsgegevens.",
        ],
      },
      {
        id: "contact",
        title: "Wijzigingen en contact",
        body: [
          `Deze verklaring heeft versie ${V}. Bij belangrijke wijzigingen vragen we je in de app opnieuw akkoord te gaan.`,
          "Contactgegevens van de beheerder:",
          { list: operatorList("nl") },
        ],
      },
    ],
  },
  en: {
    title: "Privacy statement",
    intro:
      "TeamWorkout helps sports teams plan and follow training load. Below we explain in plain language which data we process, why, who sees it and what rights you have. There is extra explanation for data about minors and for health data.",
    sections: [
      {
        id: "roles",
        title: "Who is responsible for what?",
        body: [
          "The club (the team organisation) decides why and how athlete data is processed. For team data (training, availability, wellness answers and strength tests) the club is the data controller.",
          `The operator of this app (${opName()}) acts as processor for that team data: it processes it only on behalf of the club and on its instructions. Clubs sign a processor agreement with the operator for this. Ask your club whether that has been done.`,
          "The operator is itself the controller for account (login) data, for security and for anonymous statistics about use of the service.",
        ],
      },
      {
        id: "data",
        title: "What data do we process?",
        body: [
          "We only process data that is needed for the features of the app.",
          {
            table: {
              head: ["Category", "Examples", "Purpose", "Legal basis"],
              rows: [
                ["Account", "E-mail address, password (stored only as a hash by the sign-in provider), full name, language, acceptance of the terms with version and date", "Signing in, managing the account, showing that the terms were accepted", "Performance of the agreement (art. 6(1)(b) GDPR)"],
                ["Profile", "Date of birth, height (cm), weight (kg)", "Applying age limits and calculating weights and load", "Explicit consent (art. 9(2)(a) GDPR), see below"],
                ["Team membership", "Team, role (staff or athlete), consent status, who gave it, when, and a note for parental consent", "Controlling access per team and recording consent", "Performance of the agreement; the club must be able to show consent"],
                ["Training", "Planned sessions, attendance, duration, RPE, computed load, weekly limits set by staff", "Planning and following training load", "Performance of the agreement"],
                ["Availability", "Available, limited or unavailable, plus a staff note that may reveal injury or illness", "Adjusting training to who can take part", "Explicit consent (health data)"],
                ["Wellness check", "Sleep, muscle soreness, energy, calm and mood on 1 to 5 scales", "Spotting fatigue or overload early", "Explicit consent (health data)"],
                ["Strength", "5RM tests: exercise, weight, reps, RPE, date, note", "Calculating training weights and tracking progress", "Performance of the agreement; consent where it counts as health data"],
                ["Push notifications", "Your browser's push endpoint and keys, user agent, reminder preference (only if you turn notifications on)", "Sending reminders", "Consent (given via the browser)"],
                ["Technical", "IP address and server logs at hosting and database providers; cookieless anonymous usage and performance statistics", "Security, fixing faults, improving the service", "Legitimate interest (art. 6(1)(f) GDPR)"],
              ],
            },
          },
        ],
      },
      {
        id: "health",
        title: "Health data",
        body: [
          "Availability notes, the wellness check, injury-related information and body measurements are treated as health data. This is special category data (art. 9 GDPR). We process it only with your explicit consent (art. 9(2)(a) GDPR).",
          {
            list: [
              "Athletes aged 16 or older give this consent themselves, per team, in their profile. You can withdraw it there too.",
              "For athletes under 16, a parent or guardian must consent. The club records this in the app.",
              "Staff only see an athlete's wellness answers when consent is recorded.",
              "If you withdraw consent, those answers are hidden from staff again immediately. Earlier processing remains lawful.",
            ],
          },
          "For account data and the core features we rely on performance of the agreement (art. 6(1)(b)). For security and anonymous statistics it is legitimate interest (art. 6(1)(f)). For push notifications it is your consent through the browser.",
        ],
      },
      {
        id: "access",
        title: "Who sees what?",
        body: [
          {
            list: [
              "Athletes only see their own data. Athletes never see the acute:chronic ratio.",
              "Staff of a team see that team's training and availability data. They see wellness answers only when consent is recorded.",
              "Staff of other clubs or teams see nothing.",
              "Operator staff have access only for support or security, under confidentiality.",
            ],
          },
          "We do not sell data, show advertising or build profiles with legal effects. Load ratios and signals are aids for staff. They are not automated decisions within the meaning of art. 22 GDPR: a person decides.",
        ],
      },
      {
        id: "processors",
        title: "Processors and transfers",
        body: [
          "We use the following parties. Agreements apply with them on processing data securely.",
          {
            table: {
              head: ["Party", "Used for", "Where"],
              rows: [
                ["Supabase", "Database and sign-in (authentication), including account e-mails sent via the sign-in provider", "Project hosted in the EU (Frankfurt)"],
                ["Vercel", "Hosting and delivery of the website, web statistics (Web Analytics) and performance metrics (Speed Insights)", "Vercel is a US company. Transfers outside the EEA rely on an adequacy decision or standard contractual clauses as stated in Vercel's DPA. [bevestig this against the current Vercel DPA]"],
                ["Browser push services (Google, Apple, Mozilla, Microsoft)", "Delivering push notifications, only if you turn notifications on", "Depends on your browser"],
              ],
            },
          },
          "Fonts are self-hosted when the app is built. Your browser therefore does not request fonts from Google Fonts while you use the app.",
        ],
      },
      {
        id: "retention",
        title: "How long do we keep data?",
        body: [
          {
            list: [
              "Account and team data is kept until you delete your account or leave the team. Leaving a team removes your logs in that team.",
              "Deleting your account removes your profile, logs, wellness answers, strength tests and push settings.",
              "Backups at the provider expire according to its own schedule. [bevestig the backup retention period]",
              "Technical logs are kept by the relevant provider according to its own periods.",
            ],
          },
          "Our recommendation to clubs is not to keep wellness data longer than needed, for example no more than 12 months. This is a recommendation; the app does not enforce it.",
        ],
      },
      {
        id: "rights",
        title: "Your rights",
        body: [
          "You have the right of access, rectification, erasure, restriction, portability and objection. You can withdraw consent at any time. You are not subject to a decision based solely on automated processing.",
          {
            list: [
              "In the app, on your profile page: export your data (JSON), edit your profile, withdraw consent and delete your account.",
              `For other requests, e-mail ${privMail()}. We respond within one month.`,
              "For team data you can also contact your club.",
              "If you disagree with how we handle your data, you can lodge a complaint with the Dutch Data Protection Authority (Autoriteit Persoonsgegevens, autoriteitpersoonsgegevens.nl).",
            ],
          },
        ],
      },
      {
        id: "minors",
        title: "Children and minors",
        body: [
          "In the Netherlands the age of consent is 16. For athletes under 16, a parent or guardian must consent to the processing of health data.",
          "The club is responsible for obtaining and keeping proof of that parental consent. The app only records it. Accounts for minors are used within a club context.",
        ],
      },
      {
        id: "security",
        title: "Security",
        body: [
          {
            list: [
              "Connections are encrypted with TLS.",
              "The database is located in the EU.",
              "Access is controlled per row (row level security), so users only reach data they are entitled to.",
              "Roles determine what staff and athletes can do.",
              "Passwords are stored as a hash by the sign-in provider.",
              "Operator staff access is restricted.",
            ],
          },
          "In case of a data breach we notify the club, as controller, without undue delay. Where required we also notify the Dutch Data Protection Authority.",
        ],
      },
      {
        id: "contact",
        title: "Changes and contact",
        body: [
          `This statement has version ${V}. For material changes we ask you to accept again in the app.`,
          "Operator contact details:",
          { list: operatorList("en") },
        ],
      },
    ],
  },
};
