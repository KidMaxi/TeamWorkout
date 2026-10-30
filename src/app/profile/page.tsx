import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { dateLocale } from "@/lib/i18n";
import { ConsentCard } from "@/components/ConsentCard";
import { LogoMark } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ProfileForm } from "./ProfileForm";

function ageOf(birth: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
  if (!m) return null;
  const now = new Date();
  let a = now.getUTCFullYear() - Number(m[1]);
  if (now.getUTCMonth() + 1 < Number(m[2]) || (now.getUTCMonth() + 1 === Number(m[2]) && now.getUTCDate() < Number(m[3]))) a--;
  return a >= 0 && a < 130 ? a : null;
}

export default async function ProfilePage() {
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase
    .from("profiles")
    .select("full_name, birth_date, height_cm, weight_kg, notify_reminders")
    .eq("id", user.id)
    .single();

  const { count: subCount } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { data: athleteRows } = await supabase
    .from("team_members")
    .select("team_id, consent_given, consent_at, consent_by, teams(name)")
    .eq("user_id", user.id)
    .eq("role", "athlete")
    .order("joined_at");
  let hasPin = false;
  if (athleteRows?.length) {
    const { data } = await supabase.rpc("has_athlete_pin", { _user: user.id });
    hasPin = data === true;
  }
  const age = ageOf(p?.birth_date ?? "");
  const ageState = age === null ? "unknown" : age >= 16 ? "adult" : "minor";
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(dateLocale(locale), { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-10">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="inline-flex min-h-10 items-center gap-2" aria-label={t("common.back")}>
          <ChevronLeft size={20} aria-hidden className="text-[var(--accent)]" />
          <LogoMark size={24} />
          <span className="display text-xl">{t("profile.title")}</span>
        </Link>
        <LanguageSwitcher />
      </header>
      <ProfileForm
        email={user.email ?? ""}
        initial={{
          fullName: p?.full_name ?? "",
          birthDate: p?.birth_date ?? "",
          heightCm: p?.height_cm != null ? String(p.height_cm) : "",
          weightKg: p?.weight_kg != null ? String(p.weight_kg) : "",
        }}
        remindersEnabled={p?.notify_reminders ?? true}
        hasSubscription={(subCount ?? 0) > 0}
        isAthlete={!!athleteRows?.length}
        hasPin={hasPin}
        consent={
          athleteRows?.length ? (
            <>
              {athleteRows.map((m) => (
                <ConsentCard
                  key={m.team_id}
                  teamId={m.team_id}
                  teamName={(m.teams as unknown as { name: string } | null)?.name ?? ""}
                  given={!!m.consent_given}
                  dateLabel={fmt(m.consent_at)}
                  by={m.consent_by === "parent" ? "parent" : m.consent_by === "self" ? "self" : null}
                  age={ageState}
                />
              ))}
            </>
          ) : null
        }
      />
    </div>
  );
}
