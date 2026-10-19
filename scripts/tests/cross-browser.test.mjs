import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readJson } from "../../src/lib/http/read-json.ts";

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

export default async function suite(test) {
  test("the app preloader renders the same first HTML on the server and in the browser", () => {
    const preloader = source("src/components/ui/experience-preloader.tsx");
    assert.equal(/typeof document === "undefined"/.test(preloader), false);
    assert.match(preloader, /useSyncExternalStore\(/);
    assert.match(preloader, /hydrated \? createPortal\(overlay, document\.body\) : overlay/);
  });

  test("the landing 3D model has no drei Html fallback that throws removeChild on Chrome and Safari", () => {
    const canvas = source("src/components/landing/iphone-3d-canvas.tsx");
    assert.equal(/^\s*Html,\s*$/m.test(canvas), false);
    assert.equal(/<Html[\s>]/.test(canvas.replace(/\{\/\*[\s\S]*?\*\/\}/g, "")), false);
    assert.match(canvas, /Carregando modelo…/);
    assert.match(canvas, /<ModelReady onReady=\{onModelReady\} \/>/);
  });

  const htmlError = await readJson(
    new Response("<!DOCTYPE html><html><body>Internal Server Error</body></html>", { status: 500 }),
  );
  const okJson = await readJson(new Response(JSON.stringify({ ok: true, notices: [] })));

  test("an HTML error page does not throw a JSON SyntaxError (Safari: string did not match)", () => {
    assert.deepEqual(htmlError, { ok: false, error: "Resposta inválida do servidor (HTTP 500)." });
    assert.deepEqual(okJson, { ok: true, notices: [] });
    assert.match(source("src/components/admin/avisos-admin-panel.tsx"), /readJson</);
  });

  test("product photos tolerate Safari switching loading=lazy to eager on a repeat visit", () => {
    assert.match(source("src/components/products/product-image.tsx"), /suppressHydrationWarning/);
  });

  test("notices and avisos answer JSON in demo mode instead of a 500 page", () => {
    for (const path of ["src/app/api/notices/route.ts", "src/app/api/admin/avisos/route.ts"]) {
      const route = source(path);
      assert.match(route, /if \(USE_MOCK_AUTH\)/, path);
      assert.equal(route.includes('await import("@/lib/supabase/server")'), false, path);
    }
  });
}
