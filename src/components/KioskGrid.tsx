"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BedDouble, Check, LogOut } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Avatar } from "@/components/Avatar";

export type KioskAthlete = { id: string; name: string; status: "todo" | "running" | "done" | "rest" };

/** Full-screen frame for iPad mode: covers the team header, no settings or navigation for athletes. */
export function KioskFrame({ exitHref, children }: { exitHref: string; children: React.ReactNode }) {
  const { t } = useT();
  return (
    <div
      className="fixed inset-0 z-30 overflow-y-auto"
      style={{ background: "var(--glow), var(--background)" }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-6 px-4 pb-10 pt-4 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">{t("kiosk.title")}</p>
          <Link href={exitHref} className="link inline-flex min-h-11 items-center gap-2 text-sm">
            <LogOut size={14} aria-hidden />{t("kiosk.exit")}
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

const STATUS_KEY = {
  todo: "kiosk.status.todo",
  running: "kiosk.status.running",
  done: "kiosk.status.done",
  rest: "kiosk.status.rest",
} as const;

/** Names and status only. Nothing about wellness, pain or load ever reaches this component. */
export function KioskGrid({
  teamId, sessionId, athletes,
}: { teamId: string; sessionId: string; athletes: KioskAthlete[] }) {
  const { t } = useT();
  const router = useRouter();

  // Keep statuses fresh while the iPad stands there (a teammate may finish on another device).
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30000);
    return () => window.clearInterval(id);
  }, [router]);

  if (!athletes.length) return <p className="text-muted">{t("kiosk.grid.empty")}</p>;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {athletes.map((a) => {
        const label = t(STATUS_KEY[a.status]);
        const inner = (
          <>
            <span className="relative">
              <Avatar name={a.name} size={64} />
              {a.status === "done" && (
                <span
                  aria-hidden
                  className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full"
                  style={{ background: "var(--ok-bg)", color: "var(--ok)", boxShadow: "0 0 0 2px var(--surface)" }}
                >
                  <Check size={16} />
                </span>
              )}
              {a.status === "rest" && (
                <span aria-hidden className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full bg-[var(--surface-3)] text-muted" style={{ boxShadow: "0 0 0 2px var(--surface)" }}>
                  <BedDouble size={15} />
                </span>
              )}
            </span>
            <span className="display w-full break-words text-center text-xl leading-tight sm:text-2xl">{a.name}</span>
            <span
              className={`badge ${a.status === "done" ? "badge-ok" : a.status === "running" ? "badge-watch" : "badge-none"}`}
            >
              {label}
            </span>
          </>
        );
        const cls = "card flex min-h-44 flex-col items-center justify-center gap-3 !p-4 text-center";
        // Only athletes who can still train are tappable.
        return (
          <li key={a.id}>
            {a.status === "todo" || a.status === "running" ? (
              <Link
                href={`/team/${teamId}/kiosk/${sessionId}/${a.id}`}
                className={`${cls} h-full w-full transition-transform active:scale-[0.98] ${a.status === "running" ? "border-[var(--accent)]" : ""}`}
              >
                {inner}
              </Link>
            ) : (
              <div className={`${cls} h-full opacity-60`}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
