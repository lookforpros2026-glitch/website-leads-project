import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authz";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json(auth, { status: auth.status });
  return NextResponse.json({ ok: true, uid: auth.uid, email: auth.email });
}
