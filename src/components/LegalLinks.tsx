import Link from "next/link";
import { getT } from "@/lib/i18n/server";

/** Small footer row linking the public legal pages. */
export async function LegalLinks({ className = "" }: { className?: string }) {
  const { t } = await getT();
  return (
    <nav aria-label="Legal" className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted ${className}`}>
      <Link href="/privacy" className="link">{t("legal.nav.privacy")}</Link>
      <Link href="/terms" className="link">{t("legal.nav.terms")}</Link>
      <Link href="/cookies" className="link">{t("legal.nav.cookies")}</Link>
    </nav>
  );
}
