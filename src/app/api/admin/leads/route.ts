import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

type LeadRow = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  pageSlug: string;
  status: "new" | "contacted" | "booked" | "closed" | "spam";
  createdAtMs: number | null;
  statusUpdatedAtMs: number | null;
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
  if (typeof (v as any)?._seconds === "number") return (v as any)._seconds * 1000;
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

const ALLOWED_STATUSES = new Set<LeadRow["status"]>(["new", "contacted", "booked", "closed", "spam"]);

function isLeadStatus(value: string | null): value is LeadRow["status"] {
  if (!value) return false;
  return ALLOWED_STATUSES.has(value as LeadRow["status"]);
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

    const db = getAdminDb();
    let q = db.collection("leads").orderBy("createdAt", "desc").orderBy("__name__", "desc").limit(limit);

    if (isLeadStatus(status)) {
      q = db
        .collection("leads")
        .where("status", "==", status)
        .orderBy("createdAt", "desc")
        .orderBy("__name__", "desc")
        .limit(limit);
    }

    if (cursor) {
      const c = decodeCursor(cursor);
      if (c) {
        q = q.startAfter(Timestamp.fromMillis(c.t), c.id);
      }
    }

    const snap = await q.get();

    const items: LeadRow[] = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        fullName: data.fullName ?? "",
        phone: data.phone ?? "",
        email: data.email ?? null,
        pageSlug: data.pageSlug ?? "",
        status: (data.status ?? "new") as LeadRow["status"],
        createdAtMs: tsToMs(data.createdAt),
        statusUpdatedAtMs: tsToMs(data.statusUpdatedAt),
      };
    });

    let nextCursor: string | undefined = undefined;
    const last = snap.docs[snap.docs.length - 1];

    if (last && snap.size === limit) {
      const lastData = last.data() as any;
      const tMs = tsToMs(lastData.createdAt);
      if (typeof tMs === "number") {
        nextCursor = encodeCursor({ t: tMs, id: last.id });
      }
    }

    return NextResponse.json({ items, nextCursor });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
