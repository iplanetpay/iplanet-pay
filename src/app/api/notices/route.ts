import { NextResponse } from "next/server";
import { USE_MOCK_AUTH, getCurrentUser } from "@/lib/auth/session";
import { isNoticeKind } from "@/lib/notices/copy";
import { createClient } from "@/lib/supabase/server";

function missingTable(message: string) {
  return /relation|does not exist|schema cache|column/i.test(message);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Entre para continuar." }, { status: 401 });
  }

  if (USE_MOCK_AUTH) return NextResponse.json({ ok: true, notices: [], unavailable: true });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_notices")
    .select("id, kind, title, body, coupon_code, created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    if (missingTable(error.message)) {
      return NextResponse.json({ ok: true, notices: [], unavailable: true });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  const notices = data ?? [];
  const ids = notices.map((notice) => notice.id);
  let readIds = new Set<string>();
  if (ids.length > 0) {
    const reads = await supabase
      .from("platform_notice_reads")
      .select("notice_id")
      .eq("user_id", user.id)
      .in("notice_id", ids);
    if (!reads.error) {
      readIds = new Set((reads.data ?? []).map((row) => row.notice_id));
    }
  }

  return NextResponse.json({
    ok: true,
    notices: notices
      .filter((notice) => isNoticeKind(notice.kind))
      .map((notice) => ({
        id: notice.id,
        kind: notice.kind,
        title: notice.title,
        body: notice.body,
        couponCode: notice.coupon_code,
        createdAt: notice.created_at,
        read: readIds.has(notice.id),
      })),
  });
}
