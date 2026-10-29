"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
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
      } else setInfo("Check je e-mail om je account te bevestigen.");
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1><Logo size={40} wordmarkClassName="text-3xl font-extrabold tracking-tight" /></h1>
        <p className="mt-1 text-sm text-muted">Load management voor je team</p>
      </div>
      <form onSubmit={onSubmit} className="card flex flex-col gap-3">
        {mode === "up" && (
          <input name="name" required placeholder="Naam" className="input" />
        )}
        <input name="email" type="email" required placeholder="E-mail" className="input" />
        <input name="password" type="password" required minLength={8} placeholder="Wachtwoord (min. 8)" className="input" />
        <button disabled={busy} className="btn btn-primary">
          {mode === "in" ? "Inloggen" : "Account maken"}
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
        {info && <p className="text-sm text-ok">{info}</p>}
      </form>
      <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="text-sm link">
        {mode === "in" ? "Nog geen account? Registreren" : "Al een account? Inloggen"}
      </button>
    </main>
  );
}
