import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { buildProductsFile } from "@/lib/catalog/products-transfer";
import { isTransferFormat } from "@/lib/products/import-schema";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Acesso negado" }, { status: 403 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "xlsx";
  if (!isTransferFormat(format)) {
    return NextResponse.json({ ok: false, error: "Formato inválido (csv ou xlsx)." }, { status: 400 });
  }

  const result = await buildProductsFile(format, url.searchParams.get("template") === "1");
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  const { body, contentType, fileName } = result.file;
  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
