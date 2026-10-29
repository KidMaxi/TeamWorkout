import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { LogoMark } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase
    .from("profiles")
    .select("full_name, birth_date, height_cm, weight_kg")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-10">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="inline-flex items-center gap-1.5" aria-label={t("common.back")}>
          <ChevronLeft size={20} aria-hidden />
          <LogoMark size={24} />
          <span className="text-lg font-bold">{t("profile.title")}</span>
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
      />
    </div>
  );
}
