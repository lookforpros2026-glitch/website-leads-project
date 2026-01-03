import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authz";
import { getAdminDb } from "@/lib/firebase-admin";
import { ensureDefaultTemplate } from "@/lib/templates/ensureTemplate";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const db = getAdminDb();
  const data = await ensureDefaultTemplate(db);
  return NextResponse.json({ ok: true, template: data }, { status: 200 });
}
