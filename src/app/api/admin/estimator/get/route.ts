import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authz";
import { getAdminDb } from "@/lib/firebase-admin";
import { ensureEstimatorConfig } from "@/lib/estimator/ensureConfig";

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") === "published" ? "published" : "draft";

  const db = getAdminDb();
  await ensureEstimatorConfig(db);

  const snap = await db.collection("estimator_config").doc(mode).get();
  if (!snap.exists) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, config: { id: snap.id, ...(snap.data() as any) } }, { status: 200 });
}
