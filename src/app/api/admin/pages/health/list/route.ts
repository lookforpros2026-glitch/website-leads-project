import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

type Cursor = { t: number; id: string };

function tsToMs(v: unknown): number | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
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
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
  }

  const url = new URL(req.url);
  const limit = clampInt(url.searchParams.get("limit"), 50, 1, 200);
  const cursor = url.searchParams.get("cursor");
  const status = url.searchParams.get("status");
  const missingSection = url.searchParams.get("missingSection");
  const duplicateSection = url.searchParams.get("duplicateSection");
  const serviceKey = url.searchParams.get("serviceKey");
  const zip = url.searchParams.get("zip");
  const format = url.searchParams.get("format");

  let q: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = getAdminDb()
    .collection("pages")
    .orderBy("health.scannedAt", "desc")
    .orderBy("__name__", "desc");

  if (status) q = q.where("healthStatus", "==", status);
  if (missingSection) q = q.where("healthMissingSections", "array-contains", missingSection);
  if (duplicateSection) q = q.where("healthDuplicateSections", "array-contains", duplicateSection);
  if (serviceKey) q = q.where("service.key", "==", serviceKey);
  if (zip) q = q.where("zip", "==", zip);

  if (cursor) {
    const c = decodeCursor(cursor);
    if (c) q = q.startAfter(Timestamp.fromMillis(c.t), c.id);
  }

  const snap = await q.limit(limit).get();
  const items = snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      slugPath: data.slugPath || data.slug || "",
      zip: data.zip || "",
      serviceKey: data.service?.key || data.serviceKey || "",
      healthStatus: data.healthStatus || null,
      missingCount: data.missingCount || 0,
      qaFailCount: data.qaFailCount || 0,
      duplicateCount: data.duplicateCount || 0,
      scannedAtMs: tsToMs(data.health?.scannedAt),
      health: data.health || null,
    };
  });

  let nextCursor: string | undefined = undefined;
  const last = snap.docs[snap.docs.length - 1];
  if (last && snap.size === limit) {
    const lastData = last.data() as any;
    const tMs = tsToMs(lastData.health?.scannedAt);
    if (typeof tMs === "number") nextCursor = encodeCursor({ t: tMs, id: last.id });
  }

  if (format === "csv") {
    const header = [
      "id",
      "slugPath",
      "zip",
      "serviceKey",
      "healthStatus",
      "missingCount",
      "qaFailCount",
      "duplicateCount",
      "scannedAtMs",
    ];
    const csv = [
      header.join(","),
      ...items.map((item) =>
        [
          item.id,
          item.slugPath,
          item.zip,
          item.serviceKey,
          item.healthStatus || "",
          String(item.missingCount),
          String(item.qaFailCount),
          String(item.duplicateCount),
          item.scannedAtMs ? String(item.scannedAtMs) : "",
        ]
          .map((v) => {
            const s = String(v || "");
            return s.includes(",") || s.includes("\"") || s.includes("\n") ? `"${s.replace(/\"/g, "\"\"")}"` : s;
          })
          .join(",")
      ),
    ].join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=page-health.csv",
      },
    });
  }

  return NextResponse.json({ ok: true, items, nextCursor });
}
