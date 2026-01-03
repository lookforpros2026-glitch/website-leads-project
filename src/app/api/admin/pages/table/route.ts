import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/admin/authz";
import { buildCanonicalPath } from "@/lib/page-paths";

type Status = "draft" | "published";
type SortKey = "updated" | "created";

type PageRow = {
  id: string;
  slug: string;
  city: string;
  service: string;
  status: Status;
  qaScore: number | null;
  createdAtMs: number | null;
  updatedAtMs: number | null;
  viewPath?: string | null;
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

function safeStr(v: string | null, maxLen: number) {
  if (!v) return "";
  const s = v.trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
  }
  try {
    const url = new URL(req.url);

    const limit = clampInt(url.searchParams.get("limit"), 50, 1, 100);
    const cursor = url.searchParams.get("cursor");

    const status = url.searchParams.get("status");
    const service = safeStr(url.searchParams.get("service"), 80);
    const city = safeStr(url.searchParams.get("city"), 80);
    const qtext = safeStr(url.searchParams.get("q"), 120);

    const sort = (url.searchParams.get("sort") as SortKey) || "updated";
    const sortField = sort === "created" ? "createdAt" : "updatedAt";

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

    let query = ref.orderBy(sortField, "desc").orderBy("__name__", "desc").limit(limit);
    if (cursor) {
      const c = decodeCursor(cursor);
      if (c) {
        query = query.startAfter(Timestamp.fromMillis(c.t), c.id);
      }
    }

    const snap = await query.get();

    const items: PageRow[] = snap.docs.map((d) => {
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
        status: (data.status === "published" ? "published" : "draft") as Status,
        qaScore: typeof data.qaScore === "number" ? data.qaScore : null,
        createdAtMs: tsToMs(data.createdAt),
        updatedAtMs: tsToMs(data.updatedAt),
        viewPath,
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
    return NextResponse.json(
      { ok: false, error: "server_error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
