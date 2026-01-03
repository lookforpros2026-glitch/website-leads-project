import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/admin/authz";

function tsToIso(v: any): string {
  if (!v) return "";
  if (v instanceof Timestamp) return new Date(v.toMillis()).toISOString();
  if (typeof v === "number") return new Date(v).toISOString();
  if (typeof v === "string") {
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
  }
  return "";
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  const escaped = s.replace(/"/g, '""');
  if (/[",\n\r]/.test(escaped)) return `"${escaped}"`;
  return escaped;
}

const ALLOWED_STATUSES = new Set(["new", "contacted", "booked", "closed", "spam"]);

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return new Response(JSON.stringify({ ok: false, error: auth.error, status: auth.status }), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "";
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.max(1, Math.min(50000, parseInt(limitParam, 10) || 50000)) : 50000;

    const db = getAdminDb();
    let q = db.collection("leads").orderBy("createdAt", "desc").limit(limit);
    if (status && ALLOWED_STATUSES.has(status)) {
      q = db.collection("leads").where("status", "==", status).orderBy("createdAt", "desc").limit(limit);
    }

    const snap = await q.get();

    const headers = [
      "id",
      "createdAt",
      "status",
      "fullName",
      "phone",
      "email",
      "pageSlug",
      "referrer",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
    ];

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(headers.join(",") + "\n"));

        for (const doc of snap.docs) {
          const d = doc.data() as any;
          const row = [
            doc.id,
            tsToIso(d.createdAt),
            d.status ?? "",
            d.fullName ?? "",
            d.phone ?? "",
            d.email ?? "",
            d.pageSlug ?? "",
            d.referrer ?? "",
            d.utm?.source ?? "",
            d.utm?.medium ?? "",
            d.utm?.campaign ?? "",
            d.utm?.term ?? "",
            d.utm?.content ?? "",
          ].map(csvEscape);

          controller.enqueue(encoder.encode(row.join(",") + "\n"));
        }

        controller.close();
      },
    });

    const fileName = `leads-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: "server_error", detail: err?.message ?? String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
