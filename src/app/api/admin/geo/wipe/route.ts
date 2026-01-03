import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

export const runtime = "nodejs";

async function deleteCollection(db: FirebaseFirestore.Firestore, collectionName: string) {
  let deleted = 0;
  const batchSize = 450;

  while (true) {
    const snap = await db.collection(collectionName).orderBy("__name__").limit(batchSize).get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();

    deleted += snap.size;
  }

  return deleted;
}

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const db = getAdminDb();

  try {
    const cfgRef = db.collection("config").doc("geo");
    const cfgSnap = await cfgRef.get();
    const locked = cfgSnap.exists ? (cfgSnap.data() as any).locked !== false : true;
    if (locked) {
      return NextResponse.json({ ok: false, error: "GEO_LOCKED" }, { status: 423 });
    }

    const [counties, cities, neighborhoods] = await Promise.all([
      deleteCollection(db, "geo_counties"),
      deleteCollection(db, "geo_cities"),
      deleteCollection(db, "geo_neighborhoods"),
    ]);

    await cfgRef.set(
      {
        cityCentroidsReady: false,
        cityCentroidsReadyAt: null,
        cityCentroidsReadyAtMs: null,
        cityCentroidsUpdated: 0,
        cityCentroidsMissing: 0,
        lastWipeAtMs: Date.now(),
        locked: true,
      },
      { merge: true }
    );

    return NextResponse.json(
      { ok: true, deleted: { counties, cities, neighborhoods } },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "WIPE_FAILED", stack: err?.stack || null },
      { status: 500 }
    );
  }
}


