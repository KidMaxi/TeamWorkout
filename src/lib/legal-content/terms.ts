import { LEGAL } from "@/lib/legal";
import { opCity, operatorList } from "./shared";
import type { LegalContent } from "./shared";

const V = LEGAL.termsVersion;

export const content: LegalContent = {
  nl: {
    title: "Gebruiksvoorwaarden",
    intro: "Deze voorwaarden gelden voor het gebruik van TeamWorkout. Door een account aan te maken of in te loggen ga je ermee akkoord.",
    sections: [
      {
        id: "service",
        title: "De dienst",
        body: [
          "TeamWorkout is een app waarmee sportteams trainingen plannen, trainingsbelasting volgen en beschikbaarheid, wellness en krachttests bijhouden. Staf en sporters gebruiken de app binnen een team.",
          "Hoe we met persoonsgegevens omgaan, staat in de privacyverklaring.",
        ],
      },
      {
        id: "accounts",
        title: "Accounts en beveiliging",
        body: [
          {
            list: [
              "Je gebruikt alleen je eigen inloggegevens en houdt je wachtwoord geheim.",
              "Je geeft juiste gegevens op en houdt ze actueel.",
              "Meld misbruik of een vermoeden van een gehackt account zo snel mogelijk.",
              "Voor het verwerken van gezondheidsgegevens gelden leeftijds- en toestemmingsregels. Sporters onder de 16 hebben toestemming van een ouder of voogd nodig. Zie de privacyverklaring.",
            ],
          },
        ],
      },
      {
        id: "roles",
        title: "Rollen en verantwoordelijkheden",
        body: [
          "De club of teameigenaar is verantwoordelijk voor rechtmatig gebruik van de app binnen het team. Dat betekent:",
          {
            list: [
              "sporters en ouders of voogden informeren over het gebruik van hun gegevens;",
              "toestemming van ouders of voogden voor minderjarigen verkrijgen en bewaren;",
              "stafleden instrueren om gegevens vertrouwelijk te behandelen.",
            ],
          },
          "Stafleden gebruiken gegevens van sporters alleen voor training en het welzijn van de sporter, niet voor andere doelen.",
        ],
      },
      {
        id: "use",
        title: "Toegestaan gebruik",
        body: [
          "Het is niet toegestaan om:",
          {
            list: [
              "de dienst te gebruiken voor onwettige doeleinden;",
              "toegang te zoeken tot gegevens van anderen of van andere teams;",
              "de beveiliging te omzeilen of de dienst te verstoren, bijvoorbeeld met geautomatiseerde aanvallen;",
              "onjuiste, beledigende of onrechtmatige inhoud in te voeren;",
              "inloggegevens met anderen te delen.",
            ],
          },
        ],
      },
      {
        id: "medical",
        title: "Geen medisch advies",
        body: [
          "Belastingsratio's, wellnessindicatoren en gewichten die uit RPE worden berekend zijn schattingen ter oriëntatie. Het is geen medisch of trainingsvoorschrift.",
          "Gebruikers en clubs blijven zelf verantwoordelijk voor hun beslissingen. Heb je een blessure of klachten, vraag dan advies aan een professional, zoals een arts of fysiotherapeut.",
        ],
      },
      {
        id: "availability",
        title: "Beschikbaarheid en wijzigingen van de dienst",
        body: [
          "We leveren de dienst zoals die is. De dienst kan tijdelijk niet beschikbaar zijn, bijvoorbeeld door onderhoud of storingen bij onze aanbieders. Functies kunnen veranderen of vervallen.",
        ],
      },
      {
        id: "content",
        title: "Wat je invoert",
        body: [
          "De gegevens die je invoert blijven van jou of van je club. Je geeft de beheerder het recht om ze te gebruiken voor zover nodig om de dienst te leveren, zoals opslaan, tonen aan bevoegde teamleden en back-ups maken.",
        ],
      },
      {
        id: "ip",
        title: "Intellectueel eigendom",
        body: [
          "De app, het ontwerp, de teksten en de software zijn van de beheerder of zijn licentiegevers. Je krijgt een persoonlijk, niet-overdraagbaar recht om de app te gebruiken voor het doel waarvoor hij bedoeld is.",
        ],
      },
      {
        id: "liability",
        title: "Aansprakelijkheid",
        body: [
          "[Voorlopige tekst, door een jurist te bevestigen] De beheerder is niet aansprakelijk voor schade die voortkomt uit het gebruik van de dienst, behalve bij opzet of bewuste roekeloosheid, of voor zover de wet dat niet toestaat. Een eventuele aansprakelijkheid is beperkt tot directe schade. Wettelijke rechten die niet kunnen worden uitgesloten, blijven gelden.",
        ],
      },
      {
        id: "termination",
        title: "Opschorting en beëindiging",
        body: [
          "Je kunt je account altijd zelf verwijderen op je profielpagina. Daarmee worden je gegevens verwijderd zoals beschreven in de privacyverklaring.",
          "De beheerder kan een account tijdelijk blokkeren of beëindigen bij misbruik of schending van deze voorwaarden.",
        ],
      },
      {
        id: "changes",
        title: "Wijzigingen van de voorwaarden",
        body: [
          `Deze voorwaarden hebben versie ${V}. Bij belangrijke wijzigingen vragen we je in de app opnieuw akkoord te gaan.`,
        ],
      },
      {
        id: "law",
        title: "Toepasselijk recht",
        body: [
          `Op deze voorwaarden is Nederlands recht van toepassing. Geschillen worden voorgelegd aan de bevoegde rechter in het arrondissement van de beheerder: ${opCity()} [arrondissement invullen].`,
        ],
      },
      {
        id: "contact",
        title: "Contact",
        body: [{ list: operatorList("nl") }],
      },
    ],
  },
  en: {
    title: "Terms of use",
    intro: "These terms apply to your use of TeamWorkout. By creating an account or signing in you agree to them.",
    sections: [
      {
        id: "service",
        title: "The service",
        body: [
          "TeamWorkout is an app for sports teams to plan training, follow training load and keep track of availability, wellness and strength tests. Staff and athletes use the app within a team.",
          "How we handle personal data is described in the privacy statement.",
        ],
      },
      {
        id: "accounts",
        title: "Accounts and security",
        body: [
          {
            list: [
              "You use only your own credentials and keep your password secret.",
              "You provide accurate data and keep it up to date.",
              "Report misuse or a suspected hacked account as soon as possible.",
              "Age and consent rules apply to health data. Athletes under 16 need consent from a parent or guardian. See the privacy statement.",
            ],
          },
        ],
      },
      {
        id: "roles",
        title: "Roles and responsibilities",
        body: [
          "The club or team owner is responsible for lawful use of the app within the team. This means:",
          {
            list: [
              "informing athletes and parents or guardians about the use of their data;",
              "obtaining and keeping parental or guardian consent for minors;",
              "instructing staff to treat data confidentially.",
            ],
          },
          "Staff may use athletes' data only for training and the athlete's welfare, not for other purposes.",
        ],
      },
      {
        id: "use",
        title: "Acceptable use",
        body: [
          "You may not:",
          {
            list: [
              "use the service for unlawful purposes;",
              "seek access to data of others or of other teams;",
              "bypass security or disrupt the service, for example with automated attacks;",
              "enter incorrect, offensive or unlawful content;",
              "share your credentials with others.",
            ],
          },
        ],
      },
      {
        id: "medical",
        title: "No medical advice",
        body: [
          "Load ratios, wellness indicators and weights calculated from RPE are estimates for guidance. They are not a medical or coaching prescription.",
          "Users and clubs remain responsible for their own decisions. If you have an injury or complaints, seek advice from a professional such as a doctor or physiotherapist.",
        ],
      },
      {
        id: "availability",
        title: "Availability and changes to the service",
        body: [
          "The service is provided as is. It may be temporarily unavailable, for example due to maintenance or faults at our providers. Features may change or be removed.",
        ],
      },
      {
        id: "content",
        title: "What you enter",
        body: [
          "The data you enter remains yours or your club's. You grant the operator the right to use it as far as needed to run the service, such as storing it, showing it to authorised team members and making backups.",
        ],
      },
      {
        id: "ip",
        title: "Intellectual property",
        body: [
          "The app, its design, texts and software belong to the operator or its licensors. You get a personal, non-transferable right to use the app for its intended purpose.",
        ],
      },
      {
        id: "liability",
        title: "Liability",
        body: [
          "[Provisional text, to be confirmed by a lawyer] The operator is not liable for damage arising from use of the service, except in case of intent or wilful recklessness, or to the extent the law does not allow it. Any liability is limited to direct damage. Statutory rights that cannot be excluded remain unaffected.",
        ],
      },
      {
        id: "termination",
        title: "Suspension and termination",
        body: [
          "You can delete your account yourself on your profile page. Your data is then removed as described in the privacy statement.",
          "The operator may block or terminate an account in case of misuse or breach of these terms.",
        ],
      },
      {
        id: "changes",
        title: "Changes to the terms",
        body: [
          `These terms have version ${V}. For material changes we ask you to accept again in the app.`,
        ],
      },
      {
        id: "law",
        title: "Governing law",
        body: [
          `Dutch law applies to these terms. Disputes are submitted to the competent court in the operator's district: ${opCity()} [specify district].`,
        ],
      },
      {
        id: "contact",
        title: "Contact",
        body: [{ list: operatorList("en") }],
      },
    ],
  },
};
