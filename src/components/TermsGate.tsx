import Link from "next/link";
import { Check, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { TERMS_VERSION } from "@/lib/legal";
import { acceptTerms } from "@/app/actions";

/** Prominent (not blocking) card when the user has not accepted the current terms version. */
export async function TermsGate() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("terms_version").eq("id", user.id).single();
  if (!p || p.terms_version === TERMS_VERSION) return null;
  const { t } = await getT();
  return (
    <section
      className="card card-hero flex flex-col gap-3"
      aria-labelledby="terms-gate-title"
      style={{ borderColor: "var(--accent)" }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full text-[var(--accent)]"
          style={{ background: "linear-gradient(145deg, var(--surface-3), var(--surface-2))", boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent)" }}
        >
          <FileText size={18} />
        </span>
        <div className="min-w-0">
          <h2 id="terms-gate-title" className="display text-lg">{t("consent.terms.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("consent.terms.body")}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 text-sm">
        <Link href="/terms" className="link inline-flex min-h-11 items-center">{t("consent.terms.readTerms")}</Link>
        <Link href="/privacy" className="link inline-flex min-h-11 items-center">{t("consent.terms.readPrivacy")}</Link>
      </div>
      <form action={acceptTerms}>
        <button className="btn btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2">
          <Check size={16} aria-hidden />{t("consent.terms.accept")}
        </button>
      </form>
    </section>
  );
}
