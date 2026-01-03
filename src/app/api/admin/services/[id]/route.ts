import { NextResponse } from "next/server";
import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";
import { slugify } from "@/lib/slug";

function buildTokens(name: string, key: string, category?: string | null) {
  return Array.from(
    new Set(
      `${name} ${key} ${category || ""}`
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
    )
  );
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const name = body?.name != null ? String(body.name).trim() : null;
  const category =
    body?.category != null ? String(body.category).trim() : body?.groupKey != null ? String(body.groupKey).trim() : null;
  const description = body?.description != null ? String(body.description).trim() : null;
  const enabled =
    body?.enabled != null ? Boolean(body.enabled) : body?.isActive != null ? Boolean(body.isActive) : null;
  const inEstimator = body?.inEstimator != null ? Boolean(body.inEstimator) : null;
  const inGenerator = body?.inGenerator != null ? Boolean(body.inGenerator) : null;
  const sort = body?.sort != null && Number.isFinite(Number(body.sort)) ? Number(body.sort) : null;
  const key =
    body?.key != null
      ? String(body.key).trim()
      : body?.slug != null
      ? String(body.slug).trim()
      : body?.serviceKey != null
      ? String(body.serviceKey).trim()
      : null;
  const estimatorInput = body?.estimator != null ? body.estimator : body;
  const estimatorBaseMin =
    estimatorInput?.baseMin != null && Number.isFinite(Number(estimatorInput.baseMin))
      ? Number(estimatorInput.baseMin)
      : null;
  const estimatorBaseMax =
    estimatorInput?.baseMax != null && Number.isFinite(Number(estimatorInput.baseMax))
      ? Number(estimatorInput.baseMax)
      : null;
  const estimatorUnit =
    estimatorInput?.unit != null ? String(estimatorInput.unit).trim() : estimatorInput?.priceUnit != null ? String(estimatorInput.priceUnit).trim() : null;
  const estimatorEnabled = estimatorInput?.enabled != null ? Boolean(estimatorInput.enabled) : null;
  const estimatorDuration =
    estimatorInput?.defaultDurationDays && typeof estimatorInput.defaultDurationDays === "object"
      ? {
          min:
            estimatorInput.defaultDurationDays.min != null &&
            Number.isFinite(Number(estimatorInput.defaultDurationDays.min))
              ? Number(estimatorInput.defaultDurationDays.min)
              : undefined,
          max:
            estimatorInput.defaultDurationDays.max != null &&
            Number.isFinite(Number(estimatorInput.defaultDurationDays.max))
              ? Number(estimatorInput.defaultDurationDays.max)
              : undefined,
        }
      : null;

  const update: any = { updatedAt: Timestamp.now() };
  if (name != null) update.name = name;
  if (category != null) update.category = category || null;
  if (description != null) update.description = description || null;
  if (enabled != null) update.enabled = enabled;
  if (inEstimator != null) update.inEstimator = inEstimator;
  if (inGenerator != null) update.inGenerator = inGenerator;
  if (sort != null) update.sort = sort;
  if (key != null) {
    const nextKey = key || slugify(name || id);
    update.key = nextKey;
    update.slug = nextKey;
    update.serviceKey = nextKey;
  }
  if (estimatorBaseMin != null || estimatorBaseMax != null || estimatorUnit != null || estimatorEnabled != null || estimatorDuration != null) {
    update.estimator = {
      ...(body?.estimator || {}),
    };
    if (estimatorEnabled != null) update.estimator.enabled = estimatorEnabled;
    if (estimatorBaseMin != null) update.estimator.baseMin = estimatorBaseMin;
    if (estimatorBaseMax != null) update.estimator.baseMax = estimatorBaseMax;
    if (estimatorUnit != null) update.estimator.unit = estimatorUnit || "job";
    if (estimatorDuration != null) update.estimator.defaultDurationDays = estimatorDuration;
  }

  if (name != null || key != null || category != null) {
    const tokens = buildTokens(name || "", key || id, category || "");
    update.searchTokens = tokens;
  }
  update.updatedAtMs = Date.now();

  const db = getAdminDb();
  await db.collection("services").doc(id).set(update, { merge: true });
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await ctx.params;
  const db = getAdminDb();
  const url = new URL(req.url);
  const cascade = url.searchParams.get("cascade") === "1";

  await db.collection("services").doc(id).delete();

  let deletedPages = 0;
  if (cascade) {
    const seen = new Set<string>();
    const fields = ["service.key", "serviceKey"];
    for (const field of fields) {
      let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let query: FirebaseFirestore.Query = db
          .collection("pages")
          .where(field, "==", id)
          .orderBy(FieldPath.documentId())
          .limit(500);
        if (last) query = query.startAfter(last);
        const snap = await query.get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach((doc) => {
          if (seen.has(doc.id)) return;
          seen.add(doc.id);
          batch.delete(doc.ref);
          deletedPages += 1;
        });
        await batch.commit();
        last = snap.docs[snap.docs.length - 1];
      }
    }
  }

  return NextResponse.json({ ok: true, deletedPages }, { status: 200 });
}
