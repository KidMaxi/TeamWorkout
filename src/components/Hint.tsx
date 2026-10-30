import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { HintCard } from "./HintCard";

/**
 * Contextual tip for a screen. Renders nothing once the user has closed it.
 * Pass already-translated text from the caller (keys live in the caller's own message area).
 */
export async function Hint({ id, text, title, href, linkLabel }: { id: string; text: string; title?: string; href?: string; linkLabel?: string }) {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("dismissed_hints").eq("id", user.id).single();
  const dismissed: string[] = Array.isArray(data?.dismissed_hints) ? data.dismissed_hints : [];
  if (dismissed.includes(id)) return null;
  return (
    <HintCard id={id} text={text} title={title} href={href} linkLabel={linkLabel} label={t("common.hint.label")} dismissLabel={t("common.hint.dismiss")} />
  );
}
