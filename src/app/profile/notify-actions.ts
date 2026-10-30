"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type NotifyResult = { ok: boolean };

type SubInput = { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string };

const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

// Only real browser push services: the server later POSTs to this URL, so an arbitrary host would be SSRF.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/,
];

function validEndpoint(v: unknown): v is string {
  if (typeof v !== "string" || v.length > 2048) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

export async function savePushSubscription(input: SubInput): Promise<NotifyResult> {
  const endpoint = input?.endpoint;
  const p256dh = input?.keys?.p256dh;
  const auth = input?.keys?.auth;
  if (!validEndpoint(endpoint)) return { ok: false };
  if (typeof p256dh !== "string" || p256dh.length < 60 || p256dh.length > 130 || !B64URL.test(p256dh)) return { ok: false };
  if (typeof auth !== "string" || auth.length < 16 || auth.length > 40 || !B64URL.test(auth)) return { ok: false };
  const ua = typeof input.userAgent === "string" ? input.userAgent.slice(0, 300) : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // Re-subscribing the same endpoint (possibly by another account on this device) replaces the old row.
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  const { error } = await supabase
    .from("push_subscriptions")
    .insert({ user_id: user.id, endpoint, p256dh, auth, user_agent: ua });
  if (error) return { ok: false };
  revalidatePath("/profile");
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<NotifyResult> {
  if (!validEndpoint(endpoint)) return { ok: false };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  if (error) return { ok: false };
  revalidatePath("/profile");
  return { ok: true };
}

export async function setReminders(enabled: boolean): Promise<NotifyResult> {
  if (typeof enabled !== "boolean") return { ok: false };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from("profiles").update({ notify_reminders: enabled }).eq("id", user.id);
  if (error) return { ok: false };
  revalidatePath("/profile");
  return { ok: true };
}
