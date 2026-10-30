import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { LegalPage } from "@/components/LegalPage";
import { content } from "@/lib/legal-content/privacy";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: content[locale].title };
}

export default async function Page() {
  const locale = await getLocale();
  return <LegalPage doc={content[locale]} />;
}
