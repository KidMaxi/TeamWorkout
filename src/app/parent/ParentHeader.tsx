import Link from "next/link";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getT } from "@/lib/auth-cache";
import { signOut } from "@/app/actions";

/** Minimal header for the parent pages: wordmark, language and sign out. */
export async function ParentHeader() {
  const { t } = await getT();
  return (
    <header className="flex items-center justify-between gap-2">
      <Link href="/parent" aria-label={t("common.appName")} className="inline-flex min-h-11 items-center"><Logo size={28} /></Link>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <form action={signOut}>
          <button
            aria-label={t("common.logout")}
            title={t("common.logout")}
            className="glass inline-flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:text-[var(--foreground)]"
          >
            <LogOut size={18} aria-hidden />
          </button>
        </form>
      </div>
    </header>
  );
}
