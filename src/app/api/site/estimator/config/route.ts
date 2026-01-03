import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { serializeFirestore } from "@/lib/serialize-firestore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const db = getAdminDb();
  const snap = await db.collection("estimator_config").doc("published").get();
  const data = snap.exists ? (serializeFirestore(snap.data() as any) as any) : {};
  const serviceSnap = await db
    .collection("services")
    .where("enabled", "==", true)
    .get();
  const services = serviceSnap.docs
    .map((doc) => {
      const svc = serializeFirestore(doc.data() as any) as any;
      const estimator = svc.estimator || {};
      const estimatorEnabled = estimator.enabled !== false;
      const inEstimator = svc.inEstimator !== false;
      const baseMin =
        Number.isFinite(Number(estimator.baseMin))
          ? Number(estimator.baseMin)
          : Number.isFinite(Number(svc.baseMin))
          ? Number(svc.baseMin)
          : Number.isFinite(Number(svc.basePrice))
          ? Number(svc.basePrice)
          : 0;
      const baseMaxRaw =
        Number.isFinite(Number(estimator.baseMax))
          ? Number(estimator.baseMax)
          : Number.isFinite(Number(svc.baseMax))
          ? Number(svc.baseMax)
          : Number.isFinite(Number(svc.basePrice))
          ? Number(svc.basePrice)
          : baseMin;
      const defaultDuration = estimator.defaultDurationDays || {};
      return {
        key: String(svc.key || svc.serviceKey || doc.id || ""),
        name: String(svc.name || ""),
        category: String(svc.category || svc.groupKey || ""),
        enabled: svc.enabled !== false && svc.isActive !== false && estimatorEnabled && inEstimator,
        sort: Number.isFinite(Number(svc.sort)) ? Number(svc.sort) : 9999,
        baseMin,
        baseMax: Number.isFinite(Number(baseMaxRaw)) ? Number(baseMaxRaw) : baseMin,
        durationMinDays: defaultDuration.min ?? estimator.durationMinDays,
        durationMaxDays: defaultDuration.max ?? estimator.durationMaxDays,
        unit: estimator.unit || svc.priceUnit || "job",
        notes: estimator.notes || svc.notes,
      };
    })
    .filter((svc) => svc.enabled !== false)
    .sort((a, b) => (a.sort ?? 9999) - (b.sort ?? 9999));

  return NextResponse.json(
    {
      ok: true,
      config: {
        version: data.version ?? 0,
        services,
        pricing: data.pricing ?? {},
        modifiers: data.modifiers ?? {},
        steps: data.steps ?? [],
        currency: data.currency ?? "USD",
      },
    },
    { status: 200 }
  );
}
