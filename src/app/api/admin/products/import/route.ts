import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { MAX_IMPORT_BYTES, importProductsFile } from "@/lib/catalog/products-transfer";

export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_IMPORT_BYTES + 64 * 1024) {
    return NextResponse.json({ ok: false, error: "Arquivo maior que 5 MB." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Envie o arquivo como formulário." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Selecione um arquivo .xlsx ou .csv." }, { status: 400 });
  }

  const result = await importProductsFile(file, form.get("mode") === "apply");
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
