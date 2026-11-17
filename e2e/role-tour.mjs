/**
 * Role tour (Q-01): logs in as every demo role, visits every screen that role can reach at 390 px and 820 px and records
 * per visit: HTTP status, final URL (unexpected redirects), console errors / page errors, failed same-origin requests,
 * horizontal scroll, and a missing <h1>/<main>. Read-only: it only navigates (no clicks that write data).
 *
 *   # app running against the real Supabase (see PROJECT.md "Verifiëren"), e.g. on port 3200
 *   BASE_URL=http://localhost:3200 node e2e/role-tour.mjs [--roles bas,noah] [--out report.json]
 *
 * Password: DEMO_PASSWORD, or read from the header of supabase/seed/demo_academy.sql (never hardcoded here).
 * Exit code 0 = no findings, 1 = findings (see the table), 2 = tour could not run.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = (process.env.BASE_URL ?? "http://localhost:3200").replace(/\/$/, "");
const DOMAIN = "demo.courtload.test";
const SIZES = [{ name: "390", width: 390, height: 844 }, { name: "820", width: 820, height: 1180 }];
const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const id of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node-tools/node_modules/playwright"]) {
    if (!id) continue;
    try { return require(id); } catch { /* try next */ }
  }
  throw new Error("playwright not found; set PLAYWRIGHT_MODULE");
}
const { chromium } = loadPlaywright();

function demoPassword() {
  if (process.env.DEMO_PASSWORD) return process.env.DEMO_PASSWORD;
  const seed = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "seed", "demo_academy.sql");
  const m = readFileSync(seed, "utf8").match(/password\s+(\S+)/i);
  if (!m) throw new Error("set DEMO_PASSWORD (not found in the seed header)");
  return m[1];
}

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const only = opt("--roles")?.split(",");
const outFile = opt("--out");

// kind: what the role is expected to reach. "ok" = page renders; "deny" = must NOT show content (redirect or 404).
const ROLES = [
  { key: "hugo", email: `hugo@${DOMAIN}`, label: "hoofdcoach", staff: true, head: true },
  { key: "bas", email: `bas@${DOMAIN}`, label: "basketbaltrainer", staff: true },
  { key: "gwen", email: `gwen@${DOMAIN}`, label: "S&C-trainer", staff: true },
  { key: "eva", email: `eva@${DOMAIN}`, label: "basketbal+S&C", staff: true },
  { key: "anna", email: `anna@${DOMAIN}`, label: "beheerder", admin: true },
  { key: "petra", email: `petra@${DOMAIN}`, label: "ouder", parent: true },
  { key: "noah", email: `noah.de.vries@${DOMAIN}`, label: "speler", athlete: true },
];

// Routes a role must NOT be able to open (expect 404 or redirect). Content there = rights leak (hoog).
const T = "^/team/[^/]+";
const DENY = {
  noah: [`${T}/(workload|members|kiosk)$`, `${T}/review/`, `${T}/athlete/`, "^/academy"],
  petra: [`${T}`, "^/academy"],
  anna: [`${T}`],
};
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const findings = [];
const noMain = new Set();
const visits = [];

async function login(browser, role, password) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "nl-NL" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', role.email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }),
    page.press('input[name="password"]', 'Enter'),
  ]);
  return { ctx, page };
}

const collectLinks = (page, re) => page.$$eval("a[href]", (as, src) => [...new Set(as.map((a) => a.getAttribute("href")).filter((h) => h && new RegExp(src).test(h)))], re);

async function discover(page, role) {
  const found = { teams: [], routes: new Set() };
  await page.goto(`${BASE}/?all=1`, { waitUntil: "networkidle" });
  const teamLinks = await collectLinks(page, `^/team/${UUID}$`);
  found.teams = teamLinks.map((h) => h.split("/")[2]);
  for (const r of ["/", "/profile", "/help", "/leaderboard", "/privacy", "/terms", "/cookies"]) found.routes.add(r);
  if (role.staff || role.admin) { found.routes.add("/academy"); found.routes.add("/academy/planning"); }
  if (role.parent) found.routes.add("/parent");
  found.routes.add("/parent/join");
  for (const id of found.teams) {
    for (const sub of ["", "/sessions", "/sessions/calendar", "/strength", "/strength/exercises", "/strength/workouts", "/workload", "/members", "/settings", "/kiosk"])
      found.routes.add(`/team/${id}${sub}`);
    // dynamic children: sessions, workouts, athletes
    for (const sub of ["/sessions", "/strength/workouts", "/members", ""]) {
      await page.goto(`${BASE}/team/${id}${sub}`, { waitUntil: "networkidle" }).catch(() => {});
      for (const h of await collectLinks(page, `^/team/${id}/(workout|gym|review|athlete|strength/workouts)/${UUID}`).catch(() => [])) found.routes.add(h.split("?")[0]);
    }
  }
  return found;
}

function auditVisit(role, size, route, v) {
  const issues = [];
  const want = route.split("?")[0];
  const is404 = /this page could not be found|^404\b/i.test(v.bodyStart);
  const denied = (DENY[role.key] ?? []).some((re) => new RegExp(re).test(want));
  if (denied) {
    if (!is404 && v.finalPath === want && v.status < 400) issues.push(["kritiek", `RECHTENLEK: ${role.key} ziet inhoud op ${want}`]);
    for (const [sev, msg] of issues) findings.push({ role: role.key, size, route, sev, msg });
    return issues;
  }
  if (v.status >= 500) issues.push(["hoog", `HTTP ${v.status}`]);
  if (v.finalPath !== want) issues.push(["info", `redirect ${want} -> ${v.finalPath}`]);
  if (v.scrollX) issues.push(["middel", `horizontale scroll (scrollWidth ${v.scrollWidth} > ${v.innerWidth})`]);
  for (const e of v.pageErrors) issues.push([/#418/.test(e) ? "middel" : "hoog", `pageerror: ${e.slice(0, 160)}`]);
  for (const e of v.consoleErrors) issues.push([/#418|hydrat/i.test(e) ? "middel" : "laag", `console: ${e.slice(0, 160)}`]);
  for (const f of v.failed) issues.push(["middel", `request ${f}`]);
  if (!v.hasMain && v.status < 400 && v.finalPath !== "/login") noMain.add(want.replace(new RegExp(UUID, "g"), ":id"));
  if (v.status < 400 && v.finalPath !== "/login" && !v.hasH1) issues.push(["laag", "geen <h1>"]);
  if (/application error|something went wrong|this page could not be found|^404\b|er is iets misgegaan/i.test(v.bodyStart) && v.status < 400) issues.push(["middel", `foutpagina zichtbaar met status < 400: "${v.bodyStart.replace(/\s+/g, " ").slice(0, 80)}"`]);
  for (const [sev, msg] of issues) findings.push({ role: role.key, size, route, sev, msg });
  return issues;
}

async function visit(page, role, size, route) {
  const consoleErrors = [], pageErrors = [], failed = [];
  const onConsole = (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) consoleErrors.push(m.text()); };
  const onPageError = (e) => pageErrors.push(String(e.message ?? e));
  const onResp = (r) => { if (r.status() >= 400 && r.url().startsWith(BASE) && !/\/_next\/image|favicon|sw\.js|\/_vercel\//.test(r.url()) && r.request().resourceType() !== "document") failed.push(`${r.status()} ${new URL(r.url()).pathname}`); };
  page.on("console", onConsole); page.on("pageerror", onPageError); page.on("response", onResp);
  let status = 0;
  try {
    const resp = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 45000 });
    status = resp?.status() ?? 0;
  } catch (e) { pageErrors.push(`navigatie: ${String(e.message).slice(0, 120)}`); }
  const m = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
    hasMain: !!document.querySelector("main"), hasH1: !!document.querySelector("h1"),
    bodyStart: (document.body?.innerText ?? "").slice(0, 300),
  })).catch(() => ({ scrollWidth: 0, innerWidth: 0, hasMain: false, hasH1: false, bodyStart: "" }));
  page.off("console", onConsole); page.off("pageerror", onPageError); page.off("response", onResp);
  const v = { status, finalPath: new URL(page.url()).pathname, scrollX: m.scrollWidth > m.innerWidth + 1, ...m, consoleErrors, pageErrors, failed };
  const issues = auditVisit(role, size, route, v);
  visits.push({ role: role.key, size, route, status, finalPath: v.finalPath, issues: issues.length });
}

async function main() {
  const password = demoPassword();
  const browser = await chromium.launch();
  for (const role of ROLES.filter((r) => !only || only.includes(r.key))) {
    let session;
    try { session = await login(browser, role, password); } catch (e) {
      findings.push({ role: role.key, size: "-", route: "/login", sev: "kritiek", msg: `inloggen mislukt: ${String(e.message).slice(0, 120)}` });
      console.log(`[${role.key}] LOGIN FAILED`);
      continue;
    }
    const { ctx, page } = session;
    const found = await discover(page, role);
    const routes = [...found.routes];
    console.log(`[${role.key}] ${role.label}: ${found.teams.length} team(s), ${routes.length} routes x ${SIZES.length} maten`);
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      for (const route of routes) await visit(page, role, size.name, route);
    }
    await ctx.close();
  }
  await browser.close();

  if (noMain.size) findings.push({ role: "*", size: "-", route: `${noMain.size} routes`, sev: "laag", msg: "geen <main>-landmark (toegankelijkheid)" });
  const sev = (s) => findings.filter((f) => f.sev === s).length;
  console.log(`\nBezoeken: ${visits.length}  Bevindingen: ${findings.length} (kritiek ${sev("kritiek")}, hoog ${sev("hoog")}, middel ${sev("middel")}, laag ${sev("laag")}, info ${sev("info")})`);
  const byRole = {};
  for (const f of findings) (byRole[f.role] ??= []).push(f);
  for (const [r, list] of Object.entries(byRole)) {
    console.log(`\n== ${r} ==`);
    const seen = new Set();
    for (const f of list) { const k = `${f.sev}|${f.route.replace(new RegExp(UUID, "g"), ":id")}|${f.msg}`; if (seen.has(k)) continue; seen.add(k); console.log(`  [${f.sev}] ${f.size}px ${f.route} :: ${f.msg}`); }
  }
  if (outFile) writeFileSync(outFile, JSON.stringify({ base: BASE, visits, findings }, null, 2));
  process.exit(findings.some((f) => f.sev !== "info") ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
