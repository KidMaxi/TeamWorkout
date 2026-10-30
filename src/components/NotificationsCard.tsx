"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Share } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { removePushSubscription, savePushSubscription, setReminders } from "@/app/profile/notify-actions";

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type Status = "loading" | "unsupported" | "ios" | "denied" | "off" | "on";

function urlBase64ToUint8Array(b64: string) {
  const padded = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration() {
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.ready);
}

export function NotificationsCard({ initialEnabled }: { initialEnabled: boolean; hasSubscription?: boolean }) {
  const { t } = useT();
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    (async () => {
      const ua = navigator.userAgent;
      const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      let next: Status;
      if (isIos && !standalone) next = "ios";
      else if (!supported) next = "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else if (Notification.permission === "granted") {
        try {
          const sub = await (await getRegistration()).pushManager.getSubscription();
          next = sub && initialEnabled ? "on" : "off";
        } catch {
          next = "off";
        }
      } else next = "off";
      if (alive) setStatus(next);
    })();
    return () => {
      alive = false;
    };
  }, [initialEnabled]);

  if (!VAPID_KEY) return null;

  const enable = () =>
    startTransition(async () => {
      setError(false);
      try {
        const perm = await Notification.requestPermission();
        if (perm === "denied") return setStatus("denied");
        if (perm !== "granted") return;
        const reg = await getRegistration();
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_KEY) }));
        const json = sub.toJSON();
        const saved = await savePushSubscription({
          endpoint: sub.endpoint,
          keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
          userAgent: navigator.userAgent,
        });
        const flag = await setReminders(true);
        if (!saved.ok || !flag.ok) throw new Error("save");
        setStatus("on");
      } catch {
        setError(true);
      }
    });

  const disable = () =>
    startTransition(async () => {
      setError(false);
      try {
        const sub = await (await getRegistration()).pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await removePushSubscription(endpoint);
        }
        const flag = await setReminders(false);
        if (!flag.ok) throw new Error("save");
        setStatus("off");
      } catch {
        setError(true);
      }
    });

  const on = status === "on";

  return (
    <section className="card space-y-3" aria-labelledby="notify-title">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="notify-title" className="display flex items-center gap-2 text-lg">
            {on ? <Bell size={18} aria-hidden className="text-[var(--accent)]" /> : <BellOff size={18} aria-hidden className="text-muted" />}
            {t("notify.card.title")}
          </h2>
        </div>
        {on && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={t("notify.card.toggle")}
            disabled={pending}
            onClick={disable}
            className="relative inline-flex h-11 w-14 shrink-0 items-center justify-center"
          >
            <span className="relative block h-7 w-12 rounded-full border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_25%,transparent)] transition-colors">
              <span className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-[var(--accent)] transition-all" />
            </span>
          </button>
        )}
      </div>

      <p className="text-sm text-muted">{t("notify.card.intro")}</p>

      {status === "ios" && (
        <p className="flex items-start gap-2 text-sm">
          <Share size={16} aria-hidden className="mt-0.5 shrink-0 text-[var(--accent)]" />
          {t("notify.card.iosHint")}
        </p>
      )}
      {status === "unsupported" && <p className="text-sm text-muted">{t("notify.card.unsupported")}</p>}
      {status === "denied" && <p className="text-sm text-muted">{t("notify.card.denied")}</p>}

      {status === "off" && (
        <button type="button" onClick={enable} disabled={pending} className="btn btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2">
          <Bell size={16} aria-hidden />
          {pending ? t("notify.card.enabling") : t("notify.card.enable")}
        </button>
      )}
      {on && <p className="text-sm font-medium text-[var(--accent)]">{t("notify.card.on")}</p>}

      <div aria-live="polite">{error && <p className="text-sm text-danger">{t("notify.card.error")}</p>}</div>
    </section>
  );
}
