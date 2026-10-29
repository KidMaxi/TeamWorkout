"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, User, LogIn, UserPlus } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/client";

function Field({ icon: Icon, ...props }: { icon: typeof Mail } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Icon size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input {...props} aria-label={props.placeholder} className="input w-full pl-9" />
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { t } = useT();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    const supabase = createClient();
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else {
        router.push("/");
        router.refresh();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: String(f.get("name")) } },
      });
      if (error) setError(error.message);
      else if (data.session) {
        router.push("/");
        router.refresh();
      } else setInfo(t("auth.checkEmail"));
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div className="absolute right-4 top-4"><LanguageSwitcher /></div>
      <div>
        <h1><Logo size={40} wordmarkClassName="text-3xl font-extrabold tracking-tight" /></h1>
        <p className="mt-1 text-sm text-muted">{t("common.tagline")}</p>
      </div>
      <form onSubmit={onSubmit} className="card flex flex-col gap-3">
        {mode === "up" && (
          <Field icon={User} name="name" required placeholder={t("auth.name")} />
        )}
        <Field icon={Mail} name="email" type="email" required placeholder={t("auth.email")} />
        <Field icon={Lock} name="password" type="password" required minLength={8} placeholder={t("auth.password")} />
        <button disabled={busy} className="btn btn-primary inline-flex items-center justify-center gap-2">
          {mode === "in" ? <LogIn size={16} aria-hidden /> : <UserPlus size={16} aria-hidden />}
          {mode === "in" ? t("auth.signIn") : t("auth.signUp")}
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
        {info && <p className="text-sm text-ok">{info}</p>}
      </form>
      <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="text-sm link">
        {mode === "in" ? t("auth.noAccount") : t("auth.haveAccount")}
      </button>
    </main>
  );
}
