#!/usr/bin/env node
// Cross-browser smoke: every page in Chromium and WebKit (Safari engine), desktop and phone.
// Needs a mock-auth dev server: USE_MOCK_AUTH=true npx next dev --turbopack -p 3001
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, devices, webkit } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:3001";
const OUT = process.env.SMOKE_OUT ?? "/tmp/iplanet-smoke";
const ONLY = process.env.SMOKE_ONLY?.split(",").filter(Boolean) ?? [];
mkdirSync(OUT, { recursive: true });

const PUBLIC_PAGES = ["/", "/entrar", "/criar-conta", "/termos", "/ajuda"];
const CLIENT_PAGES = [
  "/app",
  "/app/catalogo",
  "/app/carteira",
  "/app/metas",
  "/app/simulador",
  "/app/ranking",
  "/app/indicacoes",
  "/app/configuracoes",
  "/app/reservas",
];
const ADMIN_PAGES = [
  "/admin",
  "/admin/dashboards",
  "/admin/reservas",
  "/admin/retirada-envio",
  "/admin/avaliacao-usados",
  "/admin/clientes",
  "/admin/produtos",
  "/admin/whatsapp",
  "/admin/financeiro",
  "/admin/sorteio",
  "/admin/avisos",
  "/admin/config",
  "/admin/indicacoes",
  "/admin/ajuda",
];

const TARGETS = [
  { name: "chrome-desktop", engine: chromium, context: { viewport: { width: 1280, height: 800 } } },
  { name: "chrome-phone", engine: chromium, context: devices["Pixel 7"] },
  { name: "safari-desktop", engine: webkit, context: devices["Desktop Safari"] },
  { name: "safari-phone", engine: webkit, context: devices["iPhone 14"] },
].filter((target) => ONLY.length === 0 || ONLY.includes(target.name));

const IGNORED_CONSOLE = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /\[HMR\]/i,
  /Supabase server client indisponível em modo mock/i,
  // Inside Google's own Maps embed iframe (WebKit blocks one of its internal RPCs).
  /maps\.googleapis\.com|gmp-place-details|PLACES_GET_PLACE/i,
];

function slug(path) {
  return path === "/" ? "home" : path.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "_");
}

function sessionCookie(role) {
  const url = new URL(BASE);
  return {
    name: "iplanet_mock_session",
    value: JSON.stringify({ role }),
    domain: url.hostname,
    path: "/",
  };
}

async function waitForReady(page) {
  await page.waitForLoadState("load", { timeout: 60_000 }).catch(() => {});
  // The boot/route preloader must lift on its own; a stuck overlay is a bug.
  const stuck = await page
    .waitForFunction(
      () =>
        document.readyState === "complete" &&
        !document.querySelector('.experience-preloader-overlay, [aria-label="Carregando experiência"]'),
      null,
      { timeout: 20_000 },
    )
    .then(() => false)
    .catch(() => true);
  await page.waitForTimeout(600);
  return stuck;
}

async function layoutIssues(page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const scroller = document.scrollingElement ?? document.documentElement;
    const issues = [];
    if (scroller.scrollWidth > width + 1) issues.push(`rolagem horizontal: ${scroller.scrollWidth}px > ${width}px`);
    const offenders = [];
    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.position === "fixed" || style.visibility === "hidden") continue;
      if (rect.right > width + 2 && !el.closest("[data-allow-overflow], [aria-hidden=true]")) {
        let clipped = false;
        for (let parent = el.parentElement; parent; parent = parent.parentElement) {
          const ps = getComputedStyle(parent);
          if (/(hidden|clip|auto|scroll)/.test(ps.overflowX) && parent.getBoundingClientRect().right <= width + 2) {
            clipped = true;
            break;
          }
        }
        if (!clipped) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
      }
      if (offenders.length >= 3) break;
    }
    if (offenders.length) issues.push(`elementos para fora da tela: ${offenders.join(" | ")}`);
    return issues;
  });
}

function watch(page, bucket) {
  page.on("pageerror", (error) => {
    if (IGNORED_CONSOLE.some((pattern) => pattern.test(error.message))) return;
    bucket.push(`erro JS: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) return;
    bucket.push(`console: ${text.slice(0, 240)}`);
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin !== new URL(BASE).origin) return;
    const status = response.status();
    if (status >= 500) bucket.push(`HTTP ${status} ${url.pathname}`);
  });
}

async function visit(context, target, path, results) {
  const page = await context.newPage();
  const problems = [];
  watch(page, problems);
  let finalUrl = "";
  try {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    if (response && response.status() >= 400) problems.push(`página respondeu ${response.status()}`);
    if (await waitForReady(page)) problems.push("tela de carregamento não sumiu em 20s");
    problems.push(...(await layoutIssues(page)));
    finalUrl = new URL(page.url()).pathname;
    if (finalUrl !== path && !(path === "/app/reservas" && finalUrl.startsWith("/app"))) {
      problems.push(`redirecionou para ${finalUrl}`);
    }
    await page.screenshot({ path: `${OUT}/${target.name}-${slug(path)}.png`, fullPage: false });
  } catch (error) {
    problems.push(`falhou ao abrir: ${error.message.split("\n")[0]}`);
  }
  results.push({ target: target.name, path, problems });
  await page.close();
}

async function check(context, target, name, fn, results) {
  const page = await context.newPage();
  const problems = [];
  watch(page, problems);
  try {
    await fn(page, problems);
  } catch (error) {
    problems.push(`falhou: ${error.message.split("\n")[0]}`);
    await page.screenshot({ path: `${OUT}/${target.name}-fail-${slug(name)}.png` }).catch(() => {});
  }
  results.push({ target: target.name, path: `interação: ${name}`, problems });
  await page.close();
}

const phone = (target) => target.name.endsWith("phone");

async function clientInteractions(context, target, results) {
  await check(context, target, "menu do celular com Guia e Termos abaixo de Sair", async (page, problems) => {
    await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded" });
    await waitForReady(page);
    if (!phone(target)) {
      const footer = page.locator("footer", { hasText: "Termos de uso" });
      if (!(await footer.isVisible())) problems.push("rodapé com Guia/Termos não aparece no computador");
      return;
    }
    const footerVisible = await page.locator("footer", { hasText: "Termos de uso" }).isVisible();
    if (footerVisible) problems.push("rodapé fixo aparece no celular");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    const menu = page.getByRole("menu");
    await menu.waitFor({ state: "visible", timeout: 5000 });
    const items = await menu.locator("a, button").allInnerTexts();
    const names = items.map((item) => item.trim()).filter(Boolean);
    const sair = names.indexOf("Sair");
    const guia = names.indexOf("Guia");
    if (sair < 0 || guia < 0 || guia < sair) problems.push(`ordem do menu: ${names.join(", ")}`);
    await page.screenshot({ path: `${OUT}/${target.name}-menu.png` });
  }, results);

  await check(context, target, "setas das reservas na tela inicial", async (page, problems) => {
    await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded" });
    await waitForReady(page);
    const next = page.getByRole("button", { name: "Próxima reserva" });
    if ((await next.count()) === 0) {
      problems.push("sem seta (crie 2 reservas no mock para testar)");
      return;
    }
    const selected = () =>
      page.getByRole("tab", { selected: true }).first().getAttribute("aria-label");
    const before = await selected();
    await next.scrollIntoViewIfNeeded();
    await next.click();
    await page.waitForTimeout(700);
    const after = await selected();
    if (before === after) problems.push(`clicar em Próxima reserva não trocou a reserva (${before})`);
    await page.getByRole("button", { name: "Reserva anterior" }).click();
    await page.waitForTimeout(700);
    if ((await selected()) !== before) problems.push("Reserva anterior não voltou para a reserva inicial");
  }, results);

  await check(context, target, "metas: grade, porcentagem e calendário", async (page, problems) => {
    await page.goto(`${BASE}/app/metas`, { waitUntil: "domcontentloaded" });
    await waitForReady(page);
    const card = page.getByTestId("metas-goal-card").first();
    if ((await card.count()) === 0) {
      problems.push("nenhuma meta no mock");
      return;
    }
    const ring = card.locator(".progress-ring");
    const shadow = await ring.evaluate((el) => getComputedStyle(el).boxShadow);
    if (shadow && shadow !== "none") problems.push(`anel com contorno: ${shadow}`);
    if (!/\d+\s*%/.test(await card.innerText())) problems.push("porcentagem não aparece no cartão");
    await card.click();
    await page.getByTestId("calendario-aportes").waitFor({ state: "visible", timeout: 20_000 });
    if ((await page.getByText("Topo", { exact: true }).count()) > 0) problems.push("palavra Topo na tela");
    await page.screenshot({ path: `${OUT}/${target.name}-meta.png` });
  }, results);

  await check(context, target, "rolagem da página inicial até o rodapé", async (page, problems) => {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await waitForReady(page);
    const start = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 2500).catch(() => {});
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1500);
    const end = await page.evaluate(() => window.scrollY);
    if (end <= start) problems.push("a página não rola");
    await page.screenshot({ path: `${OUT}/${target.name}-home-bottom.png` });
  }, results);
}

async function adminInteractions(context, target, results) {
  await check(context, target, "pop-up do cliente em Retirada/Envio com valores ocultos", async (page, problems) => {
    await page.goto(`${BASE}/admin/retirada-envio`, { waitUntil: "domcontentloaded" });
    await waitForReady(page);
    await page.getByTestId("fulfillment-card").first().waitFor({ timeout: 20_000 });
    const toggle = page.getByRole("button", { name: /valores/ });
    if ((await toggle.innerText()).includes("Ocultar")) await toggle.click();
    const clientButton = page.getByTestId("fulfillment-card").first().getByRole("button").first();
    await clientButton.click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 10_000 });
    await page.waitForTimeout(2500);
    const text = await dialog.innerText();
    if (/R\$\s*\d/.test(text)) problems.push("valores visíveis no pop-up com Ocultar valores ligado");
    await page.screenshot({ path: `${OUT}/${target.name}-cliente-popup.png` });
    await page.keyboard.press("Escape");
    await toggle.click();
  }, results);

  await check(context, target, "pop-up do cliente em Reservas", async (page, problems) => {
    await page.goto(`${BASE}/admin/reservas`, { waitUntil: "domcontentloaded" });
    await waitForReady(page);
    const opener = page.getByRole("button", { name: /^Ver cliente/ }).first();
    if ((await opener.count()) === 0) {
      problems.push("nenhum cliente clicável na lista");
      return;
    }
    await opener.click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 10_000 });
    const text = await page.getByRole("dialog").innerText();
    if (/\bCrédito\b|\bTrocar\b/.test(text)) problems.push("botões Crédito/Trocar ainda aparecem");
  }, results);

  await check(context, target, "menu lateral do admin no celular", async (page, problems) => {
    if (!phone(target)) return;
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    await waitForReady(page);
    const open = page.getByRole("button", { name: /menu/i }).first();
    await open.click();
    const link = page.getByRole("link", { name: "Retirada/Envio" }).last();
    await link.waitFor({ state: "visible", timeout: 5000 });
    await link.click();
    await page.waitForURL(/retirada-envio/, { timeout: 30_000 });
    if (await waitForReady(page)) problems.push("tela de carregamento travou ao navegar pelo menu");
  }, results);
}

/** Mock data lives in the dev server memory: make sure the client has 2 reservations with goals. */
async function seedMockClient() {
  const headers = {
    "content-type": "application/json",
    cookie: `iplanet_mock_session=${encodeURIComponent(JSON.stringify({ role: "cliente" }))}`,
  };
  const home = await fetch(`${BASE}/app`, { headers });
  const html = await home.text();
  const reservations = new Set(html.match(/\/app\/reserva\/[0-9a-f-]{36}/g) ?? []);
  for (let i = reservations.size; i < 2; i += 1) {
    const res = await fetch(`${BASE}/api/goals`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: i === 0 ? "Air 13" : "iPhone 18",
        product_id: "mock-iphone-17",
        start_date: new Date().toISOString().slice(0, 10),
        target_date: `${new Date().getFullYear() + 1}-02-19`,
        frequency: "monthly",
      }),
    });
    console.log(`seed meta ${i + 1}: HTTP ${res.status}`);
  }
}

if (process.env.SMOKE_SEED !== "0") await seedMockClient();

const results = [];
for (const target of TARGETS) {
  const browser = await target.engine.launch();
  console.log(`\n▶ ${target.name}`);

  const anon = await browser.newContext({ ...target.context, locale: "pt-BR" });
  for (const path of PUBLIC_PAGES) await visit(anon, target, path, results);
  await anon.close();

  const client = await browser.newContext({ ...target.context, locale: "pt-BR" });
  await client.addCookies([sessionCookie("cliente")]);
  for (const path of CLIENT_PAGES) await visit(client, target, path, results);
  await clientInteractions(client, target, results);
  await client.close();

  const admin = await browser.newContext({ ...target.context, locale: "pt-BR" });
  await admin.addCookies([sessionCookie("admin")]);
  for (const path of ADMIN_PAGES) await visit(admin, target, path, results);
  await adminInteractions(admin, target, results);
  await admin.close();

  await browser.close();
  for (const row of results.filter((r) => r.target === target.name)) {
    console.log(`${row.problems.length ? "✗" : "✓"} ${row.path}${row.problems.length ? `\n    ${row.problems.join("\n    ")}` : ""}`);
  }
}

writeFileSync(`${OUT}/report.json`, JSON.stringify(results, null, 2));
const failing = results.filter((r) => r.problems.length);
console.log(`\n${results.length - failing.length}/${results.length} sem problemas. Capturas em ${OUT}`);
if (failing.length) process.exitCode = 1;
