import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdminFromAppCookies } from "@/lib/auth.app.server";

const BATCH_SIZE = 400;

export async function POST(req: Request) {
  const { admin, status } = await requireAdminFromAppCookies();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" },
      { status }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || body.confirm !== "DELETE ALL") {
    return NextResponse.json({ ok: false, error: "invalid_confirmation" }, { status: 400 });
  }

  const db = getAdminDb();
  let deleted = 0;
  while (true) {
    const snap = await db.collection("pages").limit(BATCH_SIZE).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snap.size;
  }

  return NextResponse.json({ ok: true, deletedCount: deleted });
}
