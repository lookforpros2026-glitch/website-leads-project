import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
  }

  const body = (await req.json().catch(() => null)) as any;
  const action = body?.action === "publish" ? "publish" : "unpublish";
  const serviceKey = typeof body?.serviceKey === "string" ? body.serviceKey : "";
  const countySlug = typeof body?.countySlug === "string" ? body.countySlug : "";
  const from = typeof body?.from === "string" ? body.from : "";
  const to = typeof body?.to === "string" ? body.to : "";
  const max = Math.max(1, Math.min(5000, Number(body?.max || 1000)));

  const db = getAdminDb();
  let ref: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection("pages");
  if (serviceKey) ref = ref.where("service.key", "==", serviceKey);
  if (countySlug) ref = ref.where("countySlug", "==", countySlug);
  if (from) ref = ref.where("createdAt", ">=", Timestamp.fromDate(new Date(from)));
  if (to) ref = ref.where("createdAt", "<=", Timestamp.fromDate(new Date(to)));

  let updated = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | null = null;
  const now = Timestamp.now();

  while (updated < max) {
    let q = ref.orderBy("__name__").limit(500);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => {
      if (updated >= max) return;
      batch.update(doc.ref, {
        status: action === "publish" ? "published" : "draft",
        publishedAt: action === "publish" ? now : null,
        updatedAt: now,
      });
      updated += 1;
    });
    await batch.commit();
    lastDoc = snap.docs[snap.docs.length - 1] || null;
    if (updated >= max) break;
  }

  return NextResponse.json({ ok: true, updated, capped: updated >= max });
}
