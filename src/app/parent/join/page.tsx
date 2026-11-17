import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Eye } from "lucide-react";
import { getAuthUser, getT } from "@/lib/auth-cache";
import { ParentJoinForm } from "@/components/ParentJoinForm";
import { ParentHeader } from "../ParentHeader";

export default async function ParentJoinPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const { t } = await getT();

  return (
    <main className="stagger mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-4 pb-10 pt-4 sm:px-6">
      <ParentHeader />
      <div className="flex flex-col gap-1">
        <Link href="/?all" className="inline-flex min-h-11 w-fit items-center gap-1 text-sm text-muted hover:text-[var(--foreground)]">
          <ChevronLeft size={16} aria-hidden />{t("parent.join.back")}
        </Link>
        <p className="eyebrow">{t("parent.join.eyebrow")}</p>
        <h1 className="display text-4xl">{t("parent.join.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("parent.join.intro")}</p>
      </div>

      <section className="card card-hero">
        <ParentJoinForm />
      </section>

      <section className="card flex flex-col gap-2 text-sm">
        <h2 className="display flex items-center gap-2 text-lg"><Eye size={18} aria-hidden className="text-[var(--accent)]" />{t("parent.join.seeTitle")}</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted">
          <li>{t("parent.join.see1")}</li>
          <li>{t("parent.join.see2")}</li>
          <li>{t("parent.join.see3")}</li>
        </ul>
      </section>
    </main>
  );
}
