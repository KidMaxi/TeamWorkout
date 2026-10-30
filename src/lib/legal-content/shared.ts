import { LEGAL, filled, privacyContact } from "@/lib/legal";

export type Block = string | { list: string[] } | { table: { head: string[]; rows: string[][] } };
export type Section = { id: string; title: string; body: Block[] };
export type Doc = { title: string; intro?: string; sections: Section[] };
export type LegalContent = { nl: Doc; en: Doc };

const o = LEGAL.operator;

export function operatorList(l: "nl" | "en"): string[] {
  const addr = [filled(o.address), `${filled(o.postalCode)} ${filled(o.city)}`, o.country].join(", ");
  return l === "nl"
    ? [
        `Naam: ${filled(o.name)}`,
        `Adres: ${addr}`,
        `KvK-nummer: ${filled(o.kvk)}`,
        `E-mail: ${filled(o.email)}`,
        `E-mail voor privacyverzoeken: ${privacyContact()}`,
        `Website: ${o.website}`,
      ]
    : [
        `Name: ${filled(o.name)}`,
        `Address: ${addr}`,
        `Chamber of Commerce (KvK) number: ${filled(o.kvk)}`,
        `E-mail: ${filled(o.email)}`,
        `E-mail for privacy requests: ${privacyContact()}`,
        `Website: ${o.website}`,
      ];
}

export const opName = () => filled(o.name);
export const privMail = () => privacyContact();
export const opCity = () => filled(o.city);
