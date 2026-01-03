import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const db = getAdminDb();
  const snap = await db.collection("services").get();
  let updated = 0;
  let skipped = 0;

  const batch = db.batch();
  snap.docs.forEach((doc) => {
    const data = doc.data() as any;
    const estimator = data.estimator || {};
    const baseMin = Number(estimator.baseMin ?? data.baseMin ?? data.basePrice ?? 0);
    const baseMax = Number(estimator.baseMax ?? data.baseMax ?? data.basePrice ?? baseMin);
    if (!Number.isFinite(baseMin) || !Number.isFinite(baseMax)) {
      skipped += 1;
      return;
    }
    if (baseMin >= 1000 || baseMax >= 1000) {
      skipped += 1;
      return;
    }
    const nextMin = Math.round(baseMin * 1000);
    const nextMax = Math.round(baseMax * 1000);
    batch.set(
      doc.ref,
      {
        estimator: {
          ...estimator,
          baseMin: nextMin,
          baseMax: nextMax,
        },
      },
      { merge: true }
    );
    updated += 1;
  });

  if (updated > 0) {
    await batch.commit();
  }

  return NextResponse.json({ ok: true, updated, skipped }, { status: 200 });
}
