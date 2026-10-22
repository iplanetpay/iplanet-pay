import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  imageMarkdown,
  isAllowedDescriptionImage,
  parseRichDescription,
  richDescriptionPlainText,
} from "../../src/lib/catalog/rich-description.ts";
import { productImagePath, validateProductImage } from "../../src/lib/catalog/product-image-upload.ts";

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const IMG = "https://xeeogfmmasvgbpmodqym.supabase.co/storage/v1/object/public/product-images/iphone/x.jpg";

export default function suite(test) {
  test("rich description parses sections, lists, bold, images and tables", () => {
    const md = `## Destaques\n- **A19 Pro** rápido\n- Tela grande\n\nTexto **forte** aqui.\n\n![Câmera](${IMG})\n\n## Ficha técnica\n| Item | Detalhe |\n|---|---|\n| Tela | 6,9" |\n| Chip | A19 Pro |`;
    const b = parseRichDescription(md);
    assert.deepEqual(b.map((x) => x.type), ["heading", "list", "paragraph", "image", "heading", "table"]);
    assert.deepEqual(b[1].items[0][0], { text: "A19 Pro", bold: true });
    assert.equal(b[3].url, IMG);
    assert.equal(b[3].alt, "Câmera");
    assert.deepEqual(b[5].header, ["Item", "Detalhe"]);
    assert.deepEqual(b[5].rows[1], ["Chip", "A19 Pro"]);
  });

  test("rich description never yields HTML and drops images outside product-images", () => {
    const b = parseRichDescription(`<script>alert(1)</script>\n\n![x](https://evil.com/a.jpg)\n\n![y](javascript:alert(1))\n\n![z](https://abc.supabase.co/storage/v1/object/public/avatars/a.jpg)`);
    assert.equal(b.length, 1);
    assert.equal(b[0].type, "paragraph");
    assert.equal(b[0].inlines[0].text, "<script>alert(1)</script>");
    assert.equal(isAllowedDescriptionImage(IMG), true);
    assert.equal(isAllowedDescriptionImage("/products/iphone.png"), true);
    assert.equal(isAllowedDescriptionImage("/products/../etc"), false);
    assert.equal(isAllowedDescriptionImage("http://abc.supabase.co/storage/v1/object/public/product-images/a.jpg"), false);
    const renderer = source("src/components/catalog/rich-description.tsx");
    assert.doesNotMatch(renderer, /dangerouslySetInnerHTML/);
  });

  test("plain text fallback, image snippet and upload path are safe", () => {
    assert.equal(richDescriptionPlainText("## T\nOlá **mundo**.\n- item"), "Olá mundo.");
    assert.equal(imageMarkdown(IMG, "a]b"), `\n\n![a b](${IMG})\n\n`);
    assert.match(productImagePath("iPhone 17 Pro!", "Foto Câmera.JPEG", 5), /^produtos\/iphone-17-pro\/5-foto-c-mera\.jpg$/);
    assert.equal(validateProductImage({ type: "image/gif", size: 10 }), "Use JPG, PNG ou WebP.");
    assert.equal(validateProductImage({ type: "image/png", size: 6 * 1024 * 1024 }), "A foto deve ter no máximo 5 MB.");
    assert.equal(validateProductImage({ type: "image/webp", size: 10 }), null);
  });

  test("description_md flows through catalog, admin API, modal and migration 039", () => {
    assert.match(source("src/lib/catalog/products.ts"), /description_md/);
    assert.match(source("src/app/api/admin/products/route.ts"), /description_md: body\.description_md/);
    assert.match(source("src/components/catalog/product-modal.tsx"), /<RichDescription source=\{product\.description_md\}/);
    const mig = source("supabase/migrations/039_product_rich_description.sql");
    assert.match(mig, /add column if not exists description_md text/);
    assert.match(mig, /current_user_role\(\) = 'admin'/);
    assert.doesNotMatch(mig, /service_role/);
    assert.match(source("docs/api-contract.md"), /Descrição rica de produto/);
  });
}
