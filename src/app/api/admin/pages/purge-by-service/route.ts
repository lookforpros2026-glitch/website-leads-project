import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

async function deleteByField(field: string, value: string, maxDelete: number) {
  const db = getAdminDb();
  let deleted = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | null = null;

  while (true) {
    let q = db.collection("pages").where(field, "==", value).orderBy("__name__").limit(500);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => {
      if (deleted >= maxDelete) return;
      batch.delete(doc.ref);
      deleted += 1;
    });
    await batch.commit();
    lastDoc = snap.docs[snap.docs.length - 1] || null;
    if (deleted >= maxDelete) break;
  }

  return deleted;
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
  }

  const body = (await req.json().catch(() => null)) as any;
  const serviceKey = (body?.serviceKey || "").trim();
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: "missing_service_key" }, { status: 400 });
  }

  const maxDelete = Math.max(1, Math.min(20000, Number(body?.maxDelete || 5000)));
  const deletedByKey = await deleteByField("service.key", serviceKey, maxDelete);
  const deletedBySlug = await deleteByField("service.slug", serviceKey, maxDelete - deletedByKey);
  const deletedByLegacy = await deleteByField("serviceKey", serviceKey, maxDelete - deletedByKey - deletedBySlug);
  const deletedCount = deletedByKey + deletedBySlug + deletedByLegacy;

  return NextResponse.json({ ok: true, deletedCount, capped: deletedCount >= maxDelete });
}
