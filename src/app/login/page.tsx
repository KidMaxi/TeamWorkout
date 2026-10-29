"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
      <h1 className="text-2xl font-bold">TeamWorkout</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {mode === "up" && (
          <input name="name" required placeholder="Naam" className="rounded border p-2 text-black" />
        )}
        <input name="email" type="email" required placeholder="E-mail" className="rounded border p-2 text-black" />
        <input name="password" type="password" required minLength={8} placeholder="Wachtwoord (min. 8)" className="rounded border p-2 text-black" />
        <button disabled={busy} className="rounded bg-emerald-600 p-2 font-semibold text-white disabled:opacity-50">
          {mode === "in" ? "Inloggen" : "Account maken"}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {info && <p className="text-sm text-emerald-500">{info}</p>}
      </form>
      <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="text-sm underline">
        {mode === "in" ? "Nog geen account? Registreren" : "Al een account? Inloggen"}
      </button>
    </main>
  );
}
