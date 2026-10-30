import { LEGAL } from "@/lib/legal";
import type { LegalContent } from "./shared";

const V = LEGAL.termsVersion;

export const content: LegalContent = {
  nl: {
    title: "Cookies en lokale opslag",
    intro: "Hier lees je welke cookies en andere opslag in je browser TeamWorkout gebruikt. We gebruiken geen tracking- of advertentiecookies.",
    sections: [
      {
        id: "inventory",
        title: "Overzicht",
        body: [
          {
            table: {
              head: ["Naam", "Doel", "Type", "Bewaartermijn", "Aanbieder"],
              rows: [
                ["sb-<project>-auth-token", "Houdt je ingelogd (sessie)", "Strikt noodzakelijk", "Sessie; wordt ververst zolang je de app gebruikt", "Supabase (via TeamWorkout)"],
                ["tw_locale", "Onthoudt je taalkeuze (NL of EN)", "Functioneel", "1 jaar", "TeamWorkout"],
                ["Service worker", "Maakt installeren als app mogelijk. Toont alleen pushmeldingen als je die aanzet. Data wordt niet gecachet.", "Strikt noodzakelijk / functioneel", "Tot je de app of site-data verwijdert", "TeamWorkout"],
                ["Vercel Web Analytics", "Anonieme bezoekstatistieken. Cookieloos; volgens de documentatie van Vercel slaat dit geen persoonsgegevens op in je browser.", "Statistiek, zonder cookies", "Geen opslag in je browser", "Vercel"],
                ["Vercel Speed Insights", "Anonieme prestatiemetingen van pagina's", "Statistiek, zonder cookies", "Geen opslag in je browser", "Vercel"],
              ],
            },
          },
        ],
      },
      {
        id: "details",
        title: "Toelichting",
        body: [
          {
            list: [
              "Inlogcookies zijn nodig om de dienst te leveren. Zonder deze kun je niet inloggen.",
              "De taalcookie is een voorkeur die je zelf instelt met de taalknop.",
              "De service worker is een klein script van de app zelf. Het slaat geen teamgegevens op.",
              "Pushmeldingen staan standaard uit. Zet je ze aan, dan bewaren we je push-adres, zie de privacyverklaring.",
              "We gebruiken geen lokale opslag (localStorage of IndexedDB) voor tracking.",
            ],
          },
        ],
      },
      {
        id: "banner",
        title: "Waarom geen cookiebanner?",
        body: [
          "We gebruiken alleen strikt noodzakelijke en functionele opslag, plus cookieloze anonieme statistieken. Daarvoor is geen toestemming nodig, dus tonen we ook geen cookiebanner.",
          "Voegen we ooit tracking- of marketingcookies toe, dan beoordelen we dit opnieuw en vragen we vooraf toestemming.",
        ],
      },
      {
        id: "manage",
        title: "Zelf beheren",
        body: [
          "Je kunt cookies en site-data verwijderen via de instellingen van je browser. Je wordt dan uitgelogd en je taalkeuze wordt vergeten. Meer over gegevensverwerking staat in de privacyverklaring.",
          `Versie ${V}.`,
        ],
      },
    ],
  },
  en: {
    title: "Cookies and local storage",
    intro: "This page lists the cookies and other browser storage TeamWorkout uses. We do not use tracking or advertising cookies.",
    sections: [
      {
        id: "inventory",
        title: "Overview",
        body: [
          {
            table: {
              head: ["Name", "Purpose", "Type", "Lifetime", "Provider"],
              rows: [
                ["sb-<project>-auth-token", "Keeps you signed in (session)", "Strictly necessary", "Session; refreshed while you use the app", "Supabase (via TeamWorkout)"],
                ["tw_locale", "Remembers your language choice (NL or EN)", "Functional", "1 year", "TeamWorkout"],
                ["Service worker", "Makes installing as an app possible. Shows push notifications only if you enable them. Data is not cached.", "Strictly necessary / functional", "Until you remove the app or site data", "TeamWorkout"],
                ["Vercel Web Analytics", "Anonymous visit statistics. Cookieless; according to Vercel's documentation it stores no personal data in your browser.", "Statistics, without cookies", "Nothing stored in your browser", "Vercel"],
                ["Vercel Speed Insights", "Anonymous page performance metrics", "Statistics, without cookies", "Nothing stored in your browser", "Vercel"],
              ],
            },
          },
        ],
      },
      {
        id: "details",
        title: "Explanation",
        body: [
          {
            list: [
              "Sign-in cookies are needed to provide the service. Without them you cannot sign in.",
              "The language cookie is a preference you set yourself with the language toggle.",
              "The service worker is a small script of the app itself. It does not store team data.",
              "Push notifications are off by default. If you turn them on, we store your push endpoint, see the privacy statement.",
              "We do not use local storage (localStorage or IndexedDB) for tracking.",
            ],
          },
        ],
      },
      {
        id: "banner",
        title: "Why no cookie banner?",
        body: [
          "We only use strictly necessary and functional storage, plus cookieless anonymous statistics. These do not require consent, so we do not show a cookie banner.",
          "If we ever add tracking or marketing cookies, we will re-assess this and ask for consent beforehand.",
        ],
      },
      {
        id: "manage",
        title: "Managing it yourself",
        body: [
          "You can delete cookies and site data in your browser settings. You will then be signed out and your language choice is forgotten. More about data processing is in the privacy statement.",
          `Version ${V}.`,
        ],
      },
    ],
  },
};
