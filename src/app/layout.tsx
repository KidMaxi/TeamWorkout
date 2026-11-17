import type { Metadata, Viewport } from "next";
import { Barlow, Bebas_Neue, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { RegisterSW } from "./register-sw";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/auth-cache";
import { LEGAL } from "@/lib/legal";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  // Absolute base for social image URLs; Vercel provides the production host automatically.
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : LEGAL.operator.website,
  ),
  title: "Courtload",
  description: "Trainingsload en beschikbaarheid van je team",
  appleWebApp: { capable: true, title: "Courtload" },
};

export const viewport: Viewport = {
  themeColor: "#1b1b1b",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body
        className={`${barlow.variable} ${geistMono.variable} ${bebas.variable} antialiased`}
      >
        <I18nProvider locale={locale}>{children}</I18nProvider>
        <RegisterSW />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
