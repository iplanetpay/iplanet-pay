import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Entre para continuar." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { notice_id?: string };
  const noticeId = body.notice_id?.trim() ?? "";
  if (!noticeId) {
    return NextResponse.json({ ok: false, error: "Aviso inválido." }, { status: 400 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase.from("platform_notice_reads").upsert(
    {
      notice_id: noticeId,
      user_id: user.id,
      read_at: new Date().toISOString(),
    },
    { onConflict: "notice_id,user_id" },
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
