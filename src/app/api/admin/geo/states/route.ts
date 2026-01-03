import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authz";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  return NextResponse.json({ ok: true, states: [{ code: "CA", name: "California" }] }, { status: 200 });
}
