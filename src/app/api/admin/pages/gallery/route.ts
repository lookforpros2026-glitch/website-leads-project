import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/admin-guard";
import { buildCanonicalPath } from "@/lib/page-paths";

type SortKey = "updated" | "created";

type GalleryCard = {
  id: string;
  slug: string;
  city: string;
  service: string;
  citySlug?: string | null;
  serviceSlug?: string | null;
  viewPath?: string | null;
  status: "draft" | "published";
  qaScore: number | null;
  updatedAtMs: number | null;
  createdAtMs: number | null;
};

type Cursor = { t: number; id: string };

function tsToMs(v: unknown): number | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function encodeCursor(payload: Cursor): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): Cursor | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const obj = JSON.parse(raw);
    if (typeof obj?.t !== "number" || typeof obj?.id !== "string") return null;
    return { t: obj.t, id: obj.id };
  } catch {
    return null;
  }
}

function clampInt(v: string | null, def: number, min: number, max: number) {
  const n = v ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
    }

    const url = new URL(req.url);

    const limit = clampInt(url.searchParams.get("limit"), 24, 1, 60);
    const cursor = url.searchParams.get("cursor");
    const sort = (url.searchParams.get("sort") as SortKey) || "updated";
    const sortField = sort === "created" ? "createdAt" : "updatedAt";

    const status = url.searchParams.get("status");
    const service = url.searchParams.get("service")?.trim() ?? "";
    const city = url.searchParams.get("city")?.trim() ?? "";
    const qtext = url.searchParams.get("q")?.trim() ?? "";

    let ref: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = getAdminDb().collection("pages");

    if (status === "draft" || status === "published") {
      ref = ref.where("status", "==", status);
    }
    if (service) {
      ref = ref.where("service.key", "==", service);
    }
    if (city) {
      ref = ref.where("citySlug", "==", city);
    }
    if (qtext) {
      const qn = qtext.toLowerCase();
      ref = ref.where("slugLower", ">=", qn).where("slugLower", "<", qn + "\uf8ff");
    }

    let q = ref.orderBy(sortField, "desc").orderBy("__name__", "desc").limit(limit);

    if (cursor) {
      const c = decodeCursor(cursor);
      if (c) q = q.startAfter(Timestamp.fromMillis(c.t), c.id);
    }

    const snap = await q.get();

    const items: GalleryCard[] = snap.docs.map((d) => {
      const data = d.data() as any;
      const canonicalPath = buildCanonicalPath(data);
      const slugPath = typeof data.slugPath === "string" ? data.slugPath : "";
      const viewPath =
        canonicalPath ||
        (slugPath && !slugPath.includes("__") ? slugPath : "");
      return {
        id: d.id,
        slug: data.slug ?? d.id,
        city: data.city ?? "",
        service: data.service ?? "",
        citySlug: data.citySlug ?? data.city?.slug ?? null,
        serviceSlug: data.serviceSlug ?? data.service?.slug ?? null,
        viewPath,
        status: data.status === "published" ? "published" : "draft",
        qaScore: typeof data.qaScore === "number" ? data.qaScore : null,
        updatedAtMs: tsToMs(data.updatedAt),
        createdAtMs: tsToMs(data.createdAt),
      };
    });

    let nextCursor: string | undefined = undefined;
    const last = snap.docs[snap.docs.length - 1];

    if (last && snap.size === limit) {
      const lastData = last.data() as any;
      const tMs = tsToMs(lastData[sortField]);
      if (typeof tMs === "number") nextCursor = encodeCursor({ t: tMs, id: last.id });
    }

    return NextResponse.json({ items, nextCursor });
  } catch (err: any) {
    console.error("GALLERY_API_ERROR:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Unknown error",
        code: err?.code,
        name: err?.name,
      },
      { status: 500 }
    );
  }
}
