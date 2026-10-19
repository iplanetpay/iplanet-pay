import { NextResponse } from "next/server";
import { listLeadGoalSchedule } from "@/lib/whatsapp/admin";

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get("user_id") ?? "";
  const { rows, error } = await listLeadGoalSchedule(userId);
  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, rows });
}
