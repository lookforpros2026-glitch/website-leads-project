import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/admin/authz";
import { getAdminDb } from "@/lib/firebase-admin";
import { ensureEstimatorConfig } from "@/lib/estimator/ensureConfig";

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const db = getAdminDb();
  await ensureEstimatorConfig(db);

  const draftSnap = await db.collection("estimator_config").doc("draft").get();
  if (!draftSnap.exists) {
    return NextResponse.json({ ok: false, error: "MISSING_DRAFT" }, { status: 404 });
  }

  const draft = draftSnap.data() as any;
  const nextVersion = Number(draft.version || 0) + 1;
  const kitchen = Array.isArray(draft.services)
    ? draft.services.find((s: any) => s.key === "kitchen-remodeling")
    : null;
  console.log("Publish draft kitchen baseMin/baseMax", kitchen?.baseMin, kitchen?.baseMax);

  await db.collection("estimator_config").doc("published").set(
    {
      ...draft,
      status: "published",
      version: nextVersion,
      publishedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    { merge: false }
  );

  return NextResponse.json({ ok: true, version: nextVersion }, { status: 200 });
}
