import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

export const runtime = "nodejs";

const TRACT_SOURCES = ["tract", "gazetteer_tracts_2023"];

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

    let deleted = 0;
    const batchSize = 450;

    // Best-effort cleanup: delete all tract-sourced neighborhoods (caller should wipe first if they previously imported all CA).
    while (true) {
      const snap = await db
        .collection("geo_neighborhoods")
        .where("source", "in", TRACT_SOURCES)
        .limit(batchSize)
        .get();

      if (snap.empty) break;

      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deleted += snap.size;
    }

    return NextResponse.json({ ok: true, deleted }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "WIPE_FAILED", stack: err?.stack || null },
      { status: 500 }
    );
  }
}


