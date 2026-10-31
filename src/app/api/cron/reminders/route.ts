import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { makeT, isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { todayInTeamZone } from "@/lib/wellness";
import { pushConfigured, sendToSubscription, type PushPayload } from "@/lib/push/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const CHUNK = 150;

type Row = Record<string, unknown>;
type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

const chunks = <T,>(a: T[], n = CHUNK) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !pushConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const inChunks = async (table: string, select: string, col: string, ids: string[], extra?: (q: any) => any): Promise<Row[]> => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const out: Row[] = [];
    for (const c of chunks(ids)) {
      let q = db.from(table).select(select).in(col, c);
      if (extra) q = extra(q);
      const { data, error } = await q;
      if (error) throw new Error(`${table}: ${error.code ?? "query failed"}`);
      out.push(...((data ?? []) as unknown as Row[]));
    }
    return out;
  };

  try {
    const nowMs = Date.now();
    const today = todayInTeamZone();

    // Subscriptions of users who want reminders.
    const { data: subRows, error: subErr } = await db
      .from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth");
    if (subErr) throw new Error("subscriptions");
    const allSubs = (subRows ?? []) as Sub[];
    const subUserIds = [...new Set(allSubs.map((s) => s.user_id))];
    const profiles = await inChunks("profiles", "id, locale, notify_reminders", "id", subUserIds);
    const optedIn = new Map<string, Locale>();
    for (const p of profiles) {
      if (p.notify_reminders === true) optedIn.set(p.id as string, isLocale(p.locale) ? p.locale : DEFAULT_LOCALE);
    }
    const subsByUser = new Map<string, Sub[]>();
    for (const s of allSubs) if (optedIn.has(s.user_id)) subsByUser.set(s.user_id, [...(subsByUser.get(s.user_id) ?? []), s]);
    const userIds = [...optedIn.keys()];

    const memberships = await inChunks("team_members", "team_id, user_id, role", "user_id", userIds);
    const teamsOf = new Map<string, { teamId: string; role: string }[]>();
    for (const m of memberships) {
      const list = teamsOf.get(m.user_id as string) ?? [];
      list.push({ teamId: m.team_id as string, role: m.role as string });
      teamsOf.set(m.user_id as string, list);
    }

    const athletes = userIds.filter((u) => teamsOf.get(u)?.some((t) => t.role === "athlete"));
    const staff = userIds.filter((u) => teamsOf.get(u)?.some((t) => t.role === "staff"));
    const teamIds = [...new Set(memberships.map((m) => m.team_id as string))];

    // Sessions + logs for all relevant teams.
    // Cancelled sessions owe no RPE and count nothing.
    const sessions = await inChunks("sessions", "id, team_id, starts_at, planned_duration_min", "team_id", teamIds, (q) => q.neq("status", "cancelled"));
    const sessionById = new Map(sessions.map((s) => [s.id as string, s]));
    const logs = await inChunks("session_logs", "session_id, user_id, attended, load", "session_id", [...sessionById.keys()]);
    const logKey = new Set(logs.map((l) => `${l.session_id}:${l.user_id}`));

    // Coach-excluded athletes (rest) owe no RPE for that session. Only the recent window is relevant.
    const recentIds = sessions
      .filter((s) => {
        const end = new Date(s.starts_at as string).getTime() + Number(s.planned_duration_min ?? 0) * 60_000;
        return end < nowMs && end >= nowMs - 3 * DAY;
      })
      .map((s) => s.id as string);
    const exclusions = await inChunks("session_exclusions", "session_id, user_id", "session_id", recentIds);
    const excludedKey = new Set(exclusions.map((x) => `${x.session_id}:${x.user_id}`));

    // (a) missing RPE: per athlete, count of sessions ended within last 3 days with no log.
    const missing = new Map<string, number>();
    const firstTeam = new Map<string, string>();
    for (const u of athletes) {
      const mine = teamsOf.get(u)!.filter((t) => t.role === "athlete");
      firstTeam.set(u, mine[0].teamId);
      const mineIds = new Set(mine.map((t) => t.teamId));
      let n = 0;
      for (const s of sessions) {
        if (!mineIds.has(s.team_id as string)) continue;
        const start = new Date(s.starts_at as string).getTime();
        const end = start + Number(s.planned_duration_min ?? 0) * 60_000;
        if (end < nowMs && end >= nowMs - 3 * DAY && !logKey.has(`${s.id}:${u}`) && !excludedKey.has(`${s.id}:${u}`)) n++;
      }
      if (n > 0) missing.set(u, n);
    }

    // (b) wellness not yet done today.
    const done = new Set(
      (await inChunks("wellness_checks", "user_id", "user_id", athletes, (q) => q.eq("day", today))).map((r) => r.user_id as string),
    );

    // (c) staff: high-load athletes per team (same rules as team_load_overview).
    const staffTeams = [...new Set(staff.flatMap((u) => teamsOf.get(u)!.filter((t) => t.role === "staff").map((t) => t.teamId)))];
    const athleteRows = await inChunks("team_members", "team_id, user_id", "team_id", staffTeams, (q) => q.eq("role", "athlete"));
    const limits = await inChunks("athlete_limits", "team_id, user_id, max_weekly_load", "team_id", staffTeams);
    const avail = await inChunks("availability", "team_id, user_id, status", "team_id", staffTeams);
    // The fixed acute:chronic band only drives the notification for teams that switched the ratio on (default off).
    const settingRows = await inChunks("team_workload_settings", "team_id, show_ratio", "team_id", staffTeams);
    const ratioTeams = new Set(settingRows.filter((r) => r.show_ratio === true).map((r) => r.team_id as string));
    const limitOf = new Map(limits.map((l) => [`${l.team_id}:${l.user_id}`, l.max_weekly_load as number | null]));
    const unavailable = new Set(avail.filter((a) => a.status === "unavailable").map((a) => `${a.team_id}:${a.user_id}`));
    const highByTeam = new Map<string, number>();
    for (const a of athleteRows) {
      const team = a.team_id as string;
      const uid = a.user_id as string;
      if (unavailable.has(`${team}:${uid}`)) continue;
      let acute = 0, sum28 = 0, first = Infinity;
      for (const l of logs) {
        if (l.user_id !== uid) continue;
        const s = sessionById.get(l.session_id as string);
        if (!s || s.team_id !== team) continue;
        const st = new Date(s.starts_at as string).getTime();
        const load = Number(l.load ?? 0);
        if (st >= nowMs - 7 * DAY) acute += load;
        if (st >= nowMs - 28 * DAY) sum28 += load;
        if (l.attended && st < first) first = st;
      }
      const chronic = sum28 / 4;
      const ratio = chronic > 0 && first <= nowMs - 28 * DAY ? acute / chronic : null;
      const max = limitOf.get(`${team}:${uid}`);
      if ((ratioTeams.has(team) && ratio !== null && ratio > 1.5) || (max != null && acute > max)) highByTeam.set(team, (highByTeam.get(team) ?? 0) + 1);
    }

    // Build one notification per user.
    const jobs: { userId: string; payload: PushPayload }[] = [];
    for (const u of athletes) {
      const t = makeT(optedIn.get(u)!);
      const parts: string[] = [];
      const n = missing.get(u) ?? 0;
      if (n > 0) parts.push(n === 1 ? t("notify.push.rpeOne") : t("notify.push.rpeMany", { n }));
      if (!done.has(u)) parts.push(t("notify.push.wellness"));
      if (parts.length === 0) continue;
      const teamId = firstTeam.get(u)!;
      const sessionsOnly = n > 0 && done.has(u);
      jobs.push({
        userId: u,
        payload: {
          title: t("notify.push.title"),
          body: parts.join(" "),
          url: sessionsOnly ? `/team/${teamId}/sessions` : `/team/${teamId}`,
          tag: `reminder-${today}`,
        },
      });
    }
    for (const u of staff) {
      const t = makeT(optedIn.get(u)!);
      let total = 0;
      let teamId = "";
      for (const tm of teamsOf.get(u)!) {
        if (tm.role !== "staff") continue;
        const c = highByTeam.get(tm.teamId) ?? 0;
        if (c > 0 && !teamId) teamId = tm.teamId;
        total += c;
      }
      if (total === 0) continue;
      jobs.push({
        userId: u,
        payload: {
          title: t("notify.push.staffTitle"),
          body: total === 1 ? t("notify.push.staffOne") : t("notify.push.staffMany", { n: total }),
          url: `/team/${teamId}`,
          tag: `highload-${today}`,
        },
      });
    }

    // Send, in batches; collect dead subscriptions.
    let sent = 0;
    const dead: string[] = [];
    for (const batch of chunks(jobs, 25)) {
      const results = await Promise.allSettled(
        batch.flatMap((j) =>
          (subsByUser.get(j.userId) ?? []).map(async (s) => ({ id: s.id, r: await sendToSubscription(s, j.payload) })),
        ),
      );
      for (const res of results) {
        if (res.status !== "fulfilled") continue;
        if (res.value.r.ok) sent++;
        else if (res.value.r.gone) dead.push(res.value.id);
      }
    }
    for (const c of chunks(dead)) await db.from("push_subscriptions").delete().in("id", c);

    return NextResponse.json({ athletes: athletes.length, staff: staff.length, sent, removed: dead.length });
  } catch (e) {
    console.error("cron reminders failed:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
