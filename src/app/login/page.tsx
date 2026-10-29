"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, User, LogIn, UserPlus } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { Dial } from "@/components/Dial";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/client";

function Field({ icon: Icon, ...props }: { icon: typeof Mail } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Icon size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
      <input {...props} aria-label={props.placeholder} className="input min-h-11 w-full pl-10" />
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
    <main className="relative mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4"><LanguageSwitcher /></div>

      <div className="rise flex w-full flex-col items-center">
        <div className="relative grid h-[300px] w-[300px] max-w-full place-items-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30">
            <Dial value={0.72} size={300} ticks={60} label={t("auth.dialLabel")} />
          </div>
          <LogoMark size={84} />
        </div>

        <div className="-mt-6 text-center">
          <h1 className="font-display text-xl font-extrabold uppercase tracking-[0.1em]">
            Team<span className="text-accent">Workout</span>
          </h1>
          <p className="mt-2 text-sm text-muted">{t("common.tagline")}</p>
        </div>

        <form onSubmit={onSubmit} className="card glass mt-8 flex w-full flex-col gap-3 p-5">
          {mode === "up" && <Field icon={User} name="name" required autoComplete="name" placeholder={t("auth.name")} />}
          <Field icon={Mail} name="email" type="email" required autoComplete="email" placeholder={t("auth.email")} />
          <Field
            icon={Lock}
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            placeholder={t("auth.password")}
          />
          <button disabled={busy} className="btn btn-primary mt-1 inline-flex min-h-11 w-full items-center justify-center gap-2">
            {mode === "in" ? <LogIn size={16} aria-hidden /> : <UserPlus size={16} aria-hidden />}
            {mode === "in" ? t("auth.signIn") : t("auth.signUp")}
          </button>
          <div aria-live="polite">
            {error && <p className="text-sm text-danger">{error}</p>}
            {info && <p className="text-sm text-ok">{info}</p>}
          </div>
        </form>

        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="link mt-5 min-h-10 text-sm">
          {mode === "in" ? t("auth.noAccount") : t("auth.haveAccount")}
        </button>
      </div>
    </main>
  );
}
