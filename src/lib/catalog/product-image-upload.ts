/** Upload de fotos de produto para o bucket público product-images (policy admin, migração 039). */
export const PRODUCT_IMAGES_BUCKET = "product-images";
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function productImagePath(slug: string, fileName: string, now = Date.now()): string {
  const safeSlug = (slug || "produto").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "produto";
  const ext = (/\.([a-z0-9]{3,4})$/i.exec(fileName)?.[1] ?? "jpg").toLowerCase().replace("jpeg", "jpg");
  const base = fileName.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "foto";
  return `produtos/${safeSlug}/${now}-${base}.${ext}`;
}

export function validateProductImage(file: { type: string; size: number }): string | null {
  if (!(PRODUCT_IMAGE_TYPES as readonly string[]).includes(file.type)) return "Use JPG, PNG ou WebP.";
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) return "A foto deve ter no máximo 5 MB.";
  return null;
}

export async function uploadProductImage(file: File, slug: string): Promise<{ url?: string; error?: string }> {
  const invalid = validateProductImage(file);
  if (invalid) return { error: invalid };
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const path = productImagePath(slug, file.name);
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) return { error: `Falha no upload: ${error.message}` };
  return { url: supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl };
}
