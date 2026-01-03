import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error, status: admin.status }, { status: admin.status });
  }
  return NextResponse.json({ ok: true, uid: admin.uid, email: admin.email });
}
