import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

export const runtime = "nodejs";

const COLLECTIONS = ["geo_cities", "geo_neighborhoods", "geo_neighborhoods_osm_raw", "geo_neighborhoods_tracts"] as const;

async function deleteCollection(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  writer: FirebaseFirestore.BulkWriter
) {
  let deleted = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  const pageSize = 500;

  while (true) {
    let q = db.collection(collectionName).orderBy("__name__").limit(pageSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      writer.delete(doc.ref);
      deleted += 1;
    }
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return deleted;
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const db = getAdminDb();

  const cfgRef = db.collection("config").doc("geo");
  const cfgSnap = await cfgRef.get();
  const locked = cfgSnap.exists ? (cfgSnap.data() as any).locked !== false : true;
  if (locked) {
    return NextResponse.json({ ok: false, error: "GEO_LOCKED" }, { status: 423 });
  }

  const body = await req.json().catch(() => ({}));
  const deletePages = body?.deletePages === true;

  try {
    const writer = db.bulkWriter();
    let failed = 0;
    let lastWriteError: any = null;
    writer.onWriteError((err) => {
      failed += 1;
      lastWriteError = { message: err.message, code: (err as any).code, failedAttempts: err.failedAttempts };
      return false;
    });

    const deleted: Record<string, number> = {};
    for (const col of COLLECTIONS) {
      deleted[col] = await deleteCollection(db, col, writer);
    }
    if (deletePages) {
      deleted.pages = await deleteCollection(db, "pages", writer);
    }

    await writer.close();

    if (failed > 0) {
      return NextResponse.json({ ok: false, error: "WRITE_FAILED", failed, lastWriteError, deleted }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deleted }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "RESET_FAILED", stack: err?.stack || null }, { status: 500 });
  }
}

