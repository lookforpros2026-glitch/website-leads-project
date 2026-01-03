import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
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

function normalizeEstimator(body: any) {
  const baseMin = Number.isFinite(Number(body?.baseMin)) ? Number(body.baseMin) : null;
  const baseMax = Number.isFinite(Number(body?.baseMax)) ? Number(body.baseMax) : null;
  const basePrice = Number.isFinite(Number(body?.basePrice)) ? Number(body.basePrice) : null;
  const resolvedMin = baseMin ?? basePrice ?? 0;
  const resolvedMax = baseMax ?? basePrice ?? resolvedMin;
  const unit = String(body?.unit || body?.priceUnit || "job").trim() || "job";
  const defaultDurationDays =
    body?.defaultDurationDays && typeof body.defaultDurationDays === "object"
      ? {
          min: Number.isFinite(Number(body.defaultDurationDays.min)) ? Number(body.defaultDurationDays.min) : undefined,
          max: Number.isFinite(Number(body.defaultDurationDays.max)) ? Number(body.defaultDurationDays.max) : undefined,
        }
      : undefined;
  return {
    enabled: body?.enabled !== false,
    baseMin: resolvedMin,
    baseMax: resolvedMax,
    unit,
    defaultDurationDays,
  };
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(req.url);
  const limit = Math.min(500, Math.max(10, Number(url.searchParams.get("limit") || "200")));
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();

  const db = getAdminDb();
  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection("services");
  if (q) {
    query = query.where("searchTokens", "array-contains", q);
  }
  const snap = await query.orderBy("name").limit(limit).get();
  const items = snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      key: data.key || data.slug || data.serviceKey || d.id,
      slug: data.slug || data.key || data.serviceKey || d.id,
      name: data.name || "",
      category: data.category ?? data.groupKey ?? null,
      enabled: data.enabled !== false && data.isActive !== false,
      inEstimator: data.inEstimator !== false && data.inEstimator !== 0,
      inGenerator: data.inGenerator !== false && data.inGenerator !== 0,
      sort: data.sort ?? null,
      description: data.description ?? null,
      estimator: data.estimator || {
        enabled: data.estimatorEnabled ?? true,
        unit: data.estimatorUnit || data.priceUnit || "job",
        baseMin: data.estimatorMin ?? data.baseMin ?? data.basePrice ?? 0,
        baseMax: data.estimatorMax ?? data.baseMax ?? data.basePrice ?? 0,
        defaultDurationDays: data.defaultDurationDays || undefined,
      },
      seo: data.seo || undefined,
      createdAtMs: data.createdAtMs ?? null,
      updatedAtMs: data.updatedAtMs ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  });

  return NextResponse.json({ ok: true, items, count: items.length }, { status: 200 });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "INVALID_NAME" }, { status: 400 });
  }

  const slug = String(body?.slug || body?.key || body?.serviceKey || slugify(name)).trim();
  const category = String(body?.category || body?.groupKey || "").trim();
  const description = String(body?.description || "").trim();
  const enabled = body?.enabled !== false && body?.isActive !== false;
  const inEstimator = body?.inEstimator !== false;
  const inGenerator = body?.inGenerator !== false;
  const sort = Number.isFinite(Number(body?.sort)) ? Number(body.sort) : null;
  const estimator = normalizeEstimator(body?.estimator || body);
  const seo = body?.seo && typeof body.seo === "object" ? body.seo : undefined;
  const tokens = buildTokens(name, slug, category);

  const now = Timestamp.now();
  const db = getAdminDb();
  const ref = db.collection("services").doc(slug);
  await ref.set(
    {
      key: slug,
      slug,
      serviceKey: slug,
      name,
      category: category || null,
      description: description || null,
      enabled,
      inEstimator,
      inGenerator,
      sort,
      estimator,
      seo,
      searchTokens: tokens,
      updatedAt: now,
      createdAt: now,
      updatedAtMs: Date.now(),
      createdAtMs: Date.now(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true, id: ref.id }, { status: 200 });
}
