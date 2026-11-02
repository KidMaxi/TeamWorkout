/**
 * End-to-end test of the workout runner's offline queue, in a real browser with the network
 * switched off. It runs the real WorkoutRunner against a fake in-memory server
 * (src/app/api/e2e/run), so it needs no Supabase.
 *
 *   npm run build
 *   E2E_HARNESS=1 NEXT_PUBLIC_SUPABASE_URL=http://localhost:1 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=x \
 *     npx next start -p 3111 &
 *   node e2e/offline-runner.mjs            # BASE_URL=http://localhost:3111 by default
 *
 * Playwright is resolved from the project, or from PLAYWRIGHT_MODULE (path to the package).
 * Exit code 0 = all scenarios passed.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const id of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node-tools/node_modules/playwright"]) {
    if (!id) continue;
    try { return require(id); } catch { /* try next */ }
  }
  throw new Error("playwright not found; set PLAYWRIGHT_MODULE");
}
const { chromium } = loadPlaywright();

const server = {
  state: async () => (await fetch(`${BASE}/api/e2e/run`)).json(),
  reset: async () => { await fetch(`${BASE}/api/e2e/run`, { method: "DELETE" }); },
};

const results = [];
async function scenario(name, fn) {
  try {
    await fn();
    results.push([name, true]);
    console.log(`ok   ${name}`);
  } catch (e) {
    results.push([name, false]);
    console.log(`FAIL ${name}\n     ${e.message.split("\n")[0]}`);
  }
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function open(query = "") {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addCookies([{ name: "tw_locale", value: "en", url: BASE }]);
  const page = await context.newPage();
  await server.reset();
  await page.goto(`${BASE}/e2e/runner${query}`);
  await page.getByRole("button", { name: /Save set/ }).first().waitFor();
  return { context, page };
}
const row = (page, n) => page.getByRole("group", { name: new RegExp(`Set ${n}`) });
const saveSet = (page, n) => row(page, n).getByRole("button", { name: "Save set" }).click();
const banner = (page) => page.getByText(/No connection\. \d+ left to send/);
const waitFor = async (fn, ms = 15000) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error("timeout waiting for condition");
    await new Promise((r) => setTimeout(r, 200));
  }
};

await scenario("online: a set is saved straight away, no banner", async () => {
  const { context, page } = await open();
  await saveSet(page, 1);
  await row(page, 1).getByRole("button", { name: "Reopen set" }).waitFor();
  assert.equal((await server.state()).sets.length, 1);
  assert.equal(await banner(page).count(), 0);
  await context.close();
});

await scenario("offline: sets are kept, shown as waiting, and sent in order when back online", async () => {
  const { context, page } = await open();
  await saveSet(page, 1);
  await row(page, 1).getByRole("button", { name: "Reopen set" }).waitFor();
  await context.setOffline(true);
  await saveSet(page, 2);
  await saveSet(page, 3);
  await banner(page).waitFor();
  assert.match(await banner(page).innerText(), /2 left to send/);
  await row(page, 2).getByText("Waiting for connection").waitFor();
  await row(page, 3).getByText("Waiting for connection").waitFor();
  assert.equal((await server.state()).sets.length, 1, "nothing may reach the server while offline");
  await context.setOffline(false);
  await waitFor(async () => (await server.state()).sets.length === 3);
  await banner(page).waitFor({ state: "detached" });
  assert.deepEqual((await server.state()).log, ["save:1", "save:2", "save:3"]);
  assert.equal(await page.getByText("Waiting for connection").count(), 0);
  await context.close();
});

await scenario("offline: editing a waiting set sends only the newest value", async () => {
  const { context, page } = await open();
  await context.setOffline(true);
  await saveSet(page, 1);
  await banner(page).waitFor();
  await row(page, 1).getByRole("textbox", { name: /Reps|Herh/ }).fill("8");
  await row(page, 1).getByRole("button", { name: "Save change" }).click();
  assert.match(await banner(page).innerText(), /1 left to send/);
  await context.setOffline(false);
  await waitFor(async () => (await server.state()).sets.length === 1);
  const sets = (await server.state()).sets;
  assert.equal(sets[0].reps, 8);
  assert.deepEqual((await server.state()).log, ["save:1"]);
  await context.close();
});

await scenario("offline: undoing a waiting set cancels it, nothing is sent", async () => {
  const { context, page } = await open();
  await context.setOffline(true);
  await saveSet(page, 1);
  await banner(page).waitFor();
  await row(page, 1).getByRole("button", { name: "Reopen set" }).click();
  await context.setOffline(false);
  await waitFor(async () => (await server.state()).log.includes("delete:1"));
  assert.equal((await server.state()).sets.length, 0);
  await context.close();
});

await scenario("a set the server refuses is reopened with an error, others still go through", async () => {
  const { context, page } = await open();
  await context.setOffline(true);
  await row(page, 1).getByRole("textbox", { name: /Reps/ }).fill("99");
  await saveSet(page, 1);
  await saveSet(page, 2);
  await banner(page).waitFor();
  await context.setOffline(false);
  await waitFor(async () => (await server.state()).sets.length === 1);
  await row(page, 1).getByRole("button", { name: "Save set" }).waitFor(); // reopened
  await row(page, 1).getByRole("alert").waitFor();
  await row(page, 2).getByRole("button", { name: "Reopen set" }).waitFor();
  await context.close();
});

await scenario("finishing offline shows the waiting screen, then the summary once delivered", async () => {
  const { context, page } = await open();
  await saveSet(page, 1);
  await row(page, 1).getByRole("button", { name: "Reopen set" }).waitFor();
  await context.setOffline(true);
  await saveSet(page, 2);
  await page.getByRole("button", { name: "Finish workout" }).click();
  await page.getByRole("button", { name: "Save log" }).click();
  await page.getByText("Almost done").waitFor();
  assert.equal((await server.state()).finished, null);
  await context.setOffline(false);
  await page.getByText("Well done").waitFor({ timeout: 20000 });
  const st = await server.state();
  assert.deepEqual(st.log, ["save:1", "save:2", "finish"], "sets must arrive before the finish");
  assert.ok(st.finished);
  await context.close();
});

await scenario("persist mode: the queue survives a reload and is sent afterwards", async () => {
  const { context, page } = await open("?persist=1");
  // Block only the API (not the page) so the reload itself works.
  await page.route("**/api/e2e/run", (r) => r.abort("internetdisconnected"));
  await saveSet(page, 1);
  await banner(page).waitFor();
  await page.reload();
  await page.getByText("Waiting for connection").first().waitFor();
  assert.equal((await server.state()).sets.length, 0);
  await page.unroute("**/api/e2e/run");
  await waitFor(async () => (await server.state()).sets.length === 1);
  await page.getByText("Waiting for connection").waitFor({ state: "detached" });
  await context.close();
});

await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} scenarios passed`);
process.exit(failed ? 1 : 0);
