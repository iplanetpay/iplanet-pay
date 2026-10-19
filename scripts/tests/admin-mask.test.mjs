import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

export default function suite(test) {
  test("Ocultar valores also hides money inside admin pop-ups rendered on body", () => {
    const mask = source("src/components/admin/admin-values-mask.tsx");
    assert.match(mask, /querySelectorAll<HTMLElement>\('\[role="dialog"\]'\)/);
    assert.match(mask, /observer\.observe\(document\.body/);
    assert.match(source("src/components/ui/motion.tsx"), /createPortal\([\s\S]*document\.body/);
    assert.match(source("src/components/ui/motion.tsx"), /role="dialog"/);
  });

  test("Ocultar valores never rewrites streamed HTML before React hydrates it", () => {
    const mask = source("src/components/admin/admin-values-mask.tsx");
    assert.match(mask, /key\.startsWith\("__reactFiber\$"\)/);
    assert.match(mask, /if \(!parent \|\| !hydratedByReact\(node, parent\)\) continue;/);
    assert.match(mask, /parent\.childNodes\.length === 1 && hasFiber\(parent\)/);
    assert.match(mask, /void pageSettled\(\)\.then/);
    assert.match(mask, /template\[id\^="B:"\]/);
    assert.match(mask, /revealed \? undefined : \{ visibility: "hidden" \}/);
  });
}
