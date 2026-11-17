"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MessageKey } from "@/lib/i18n";
import { isCodeShape, normalizeCode } from "@/lib/parent";
import type { DangerResult } from "@/app/actions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signed-in user links to a child with a single-use code. Redirects to /parent on success. */
export async function joinAsParent(code: string): Promise<{ error: MessageKey }> {
  const clean = normalizeCode(code);
  if (!isCodeShape(clean)) return { error: "parent.error.shape" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.rpc("join_as_parent", { _code: clean });
  if (error) {
    const m = error.message ?? "";
    if (m.includes("invalid or expired")) return { error: "parent.error.invalid" };
    if (m.includes("not allowed")) return { error: "parent.error.notAllowed" };
    return { error: "parent.error.generic" };
  }
  revalidatePath("/", "layout");
  redirect("/parent");
}

/** The parent removes the link with one of their children. */
export async function removeParentLink(childId: string): Promise<DangerResult> {
  if (!UUID_RE.test(childId)) return { error: "parent.error.generic" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.rpc("remove_parent_link", { _parent: user.id, _child: childId });
  if (error) return { error: error.message?.includes("not allowed") ? "parent.error.notAllowed" : "parent.error.generic" };
  revalidatePath("/", "layout");
  redirect("/parent");
}
