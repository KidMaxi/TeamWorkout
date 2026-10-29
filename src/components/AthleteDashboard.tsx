import Link from "next/link";
import { AVAILABILITY, SESSION_TYPES, type Availability, type SessionType } from "@/lib/load";

export type AthleteDashboardProps = {
  teamId: string;
  availability: { status: Availability; note: string | null } | null;
  pending: { id: string; type: SessionType; title: string; starts_at: string }[];
  /** Oldest first; the last entry is the current week. week_start is YYYY-MM-DD (Monday). */
  weekly: { week_start: string; total_load: number }[];
  /** Newest first. */
  recentLogs: {
    starts_at: string;
    type: SessionType;
    title: string;
    attended: boolean;
    duration_min: number;
    rpe: number;
    load: number;
  }[];
  last7Load: number;
  attendedThisWeek: number;
};

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

function AvailabilityBanner({ availability }: { availability: AthleteDashboardProps["availability"] }) {
  const status = availability?.status ?? "available";
  const note = availability?.note;
  if (status === "available") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="badge badge-ok">{AVAILABILITY.available}</span>
        {note && <span className="text-muted">{note}</span>}
      </div>
    );
  }
  const limited = status === "limited";
  return (
    <div
      className="card flex flex-col gap-1"
      role="status"
      style={{
        background: limited ? "var(--warn-bg)" : "var(--danger-bg)",
        borderColor: limited ? "var(--warn)" : "var(--danger)",
      }}
    >
      <p className="text-xs text-muted">Jouw status</p>
      <p className="text-lg font-semibold">{AVAILABILITY[status]}</p>
      {note ? <p className="text-sm">{note}</p> : <p className="text-sm text-muted">Geen toelichting van de staf.</p>}
    </div>
  );
}

function WeeklyBars({ weekly }: { weekly: AthleteDashboardProps["weekly"] }) {
  const max = Math.max(...weekly.map((w) => w.total_load), 1);
  return (
    <div className="card">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">Load per week</h3>
        <span className="text-xs text-muted">RPE &times; minuten</span>
      </div>
      <ol className="flex h-36 items-end gap-2" aria-label="Jouw load per week, laatste 6 weken">
        {weekly.map((w, i) => {
          const current = i === weekly.length - 1;
          const d = new Date(w.week_start + "T00:00:00Z");
          const label = d.toLocaleDateString("nl-NL", { day: "numeric", month: "numeric", timeZone: "UTC" });
          return (
            <li key={w.week_start} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] tabular-nums text-muted">{w.total_load}</span>
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.max((w.total_load / max) * 100, w.total_load ? 4 : 1)}%`,
                  background: current ? "var(--primary)" : "var(--line)",
                }}
                role="img"
                aria-label={`Week van ${label}${current ? " (deze week)" : ""}: load ${w.total_load}`}
              />
              <span className={`text-[10px] ${current ? "font-semibold" : "text-muted"}`}>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function AthleteDashboard({
  teamId, availability, pending, weekly, recentLogs, last7Load, attendedThisWeek,
}: AthleteDashboardProps) {
  return (
    <section className="flex flex-col gap-4">
      <AvailabilityBanner availability={availability} />

      <div className="card flex flex-col gap-3">
        <h3 className="font-semibold">Nog in te vullen</h3>
        {pending.length ? (
          <ul className="flex flex-col gap-2">
            {pending.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">{SESSION_TYPES[s.type]}{s.title ? ` ${s.title}` : ""}</p>
                  <p className="text-xs text-muted">{dateFmt(s.starts_at)}</p>
                </div>
                <Link href={`/team/${teamId}/sessions`} className="btn btn-primary">Invullen</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Alles ingevuld. Goed bezig!</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tile label="Load laatste 7 dagen" value={last7Load} />
        <Tile label="Trainingen deze week" value={attendedThisWeek} sub="aanwezig" />
      </div>

      <WeeklyBars weekly={weekly} />

      <div className="card flex flex-col gap-2">
        <h3 className="font-semibold">Recente trainingen</h3>
        {recentLogs.length ? (
          <ul className="flex flex-col text-sm">
            {recentLogs.map((l, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-[var(--line)] py-2 last:border-b-0">
                <span>
                  <span className="text-muted">{dateFmt(l.starts_at)}</span>{" "}
                  {SESSION_TYPES[l.type]}{l.title ? ` ${l.title}` : ""}
                </span>
                <span className="tabular-nums">
                  {l.attended ? `${l.duration_min} min × RPE ${l.rpe} = ${l.load}` : "Afwezig"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nog geen trainingen ingevuld.</p>
        )}
      </div>
    </section>
  );
}
