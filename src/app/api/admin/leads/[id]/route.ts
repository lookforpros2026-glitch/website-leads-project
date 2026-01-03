import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";
import { serializeFirestore } from "@/lib/serialize-firestore";

type LeadDetail = {
  id: string;
  createdAtMs: number;
  fullName?: string;
  phone?: string;
  email?: string | null;
  message?: string | null;
  slugPath?: string;
  pageSlug?: string;
  serviceKey?: string;
  serviceName?: string;
  estimateMin?: number | null;
  estimateMax?: number | null;
  estimateMid?: number | null;
  estimateConfidence?: string | null;
  durationMinDays?: number | null;
  durationMaxDays?: number | null;
  estimatorVersion?: string | null;
  estimatorConfigId?: string | null;
  referrer?: string | null;
  utm?: any | null;
  source?: { type?: string; docId?: string; url?: string } | null;
  legacySource?: { slug?: string; service?: string; city?: string };
  contact?: { name?: string; phone?: string; email?: string };
  consent?: { sms?: boolean; tsMs?: number };
  answers?: Record<string, any>;
  estimate?: { low?: number; typical?: number; high?: number; confidence?: string };
  status: "new" | "contacted" | "won" | "lost";
  assignedTo?: string | null;
  notes: Array<{ id: string; tsMs: number; text: string; author?: string }>;
};

function tsToMs(v: any): number | null {
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

function normalizeStatus(raw: any): LeadDetail["status"] {
  switch (raw) {
    case "contacted":
      return "contacted";
    case "won":
    case "booked":
      return "won";
    case "lost":
    case "closed":
    case "spam":
      return "lost";
    case "new":
    default:
      return "new";
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
  }

  try {
    const { id } = await ctx.params;
    const db = getAdminDb();
    const ref = db.collection("leads").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const data = snap.data() as any;

    const noteDocs = await ref.collection("notes").orderBy("ts", "desc").get();
    const noteList =
      noteDocs.docs.map((d) => {
        const nd = d.data() as any;
        return {
          id: d.id,
          tsMs: tsToMs(nd.ts) ?? 0,
          text: typeof nd.text === "string" ? nd.text : "",
          author: typeof nd.author === "string" ? nd.author : undefined,
        };
      }) ?? [];

    const legacyNotes = Array.isArray(data.notes)
      ? (data.notes as any[]).map((n, idx) => ({
          id: `legacy-${idx}`,
          tsMs: tsToMs(n?.at) ?? 0,
          text: typeof n?.text === "string" ? n.text : "",
          author: typeof n?.author === "string" ? n.author : undefined,
        }))
      : [];

    const notes = (noteList.length ? noteList : legacyNotes).sort((a, b) => b.tsMs - a.tsMs);

    const detail: LeadDetail = {
      id: snap.id,
      createdAtMs: tsToMs(data.createdAt) ?? Date.now(),
      fullName: typeof data.fullName === "string" ? data.fullName : undefined,
      phone: typeof data.phone === "string" ? data.phone : undefined,
      email: typeof data.email === "string" ? data.email : null,
      message: typeof data.message === "string" ? data.message : null,
      slugPath: typeof data.slugPath === "string" ? data.slugPath : undefined,
      pageSlug: typeof data.pageSlug === "string" ? data.pageSlug : undefined,
      serviceKey: typeof data.serviceKey === "string" ? data.serviceKey : undefined,
      serviceName: typeof data.serviceName === "string" ? data.serviceName : undefined,
      estimateMin: typeof data.estimateMin === "number" ? data.estimateMin : null,
      estimateMax: typeof data.estimateMax === "number" ? data.estimateMax : null,
      estimateMid: typeof data.estimateMid === "number" ? data.estimateMid : null,
      estimateConfidence: typeof data.estimateConfidence === "string" ? data.estimateConfidence : null,
      durationMinDays: typeof data.durationMinDays === "number" ? data.durationMinDays : null,
      durationMaxDays: typeof data.durationMaxDays === "number" ? data.durationMaxDays : null,
      estimatorVersion: typeof data.estimatorVersion === "string" ? data.estimatorVersion : null,
      estimatorConfigId: typeof data.estimatorConfigId === "string" ? data.estimatorConfigId : null,
      referrer: typeof data.referrer === "string" ? data.referrer : null,
      utm: data.utm ? serializeFirestore(data.utm) : null,
      source: data.source ? serializeFirestore(data.source) : null,
      legacySource: {
        slug: data.pageSlug ?? data?.source?.slug,
        service: data?.source?.service,
        city: data?.source?.city,
      },
      contact: {
        name: data.fullName ?? data?.contact?.name ?? "",
        phone: data.phone ?? data?.contact?.phone ?? "",
        email: data.email ?? data?.contact?.email ?? "",
      },
      consent: data?.consent
        ? {
            sms: Boolean(data.consent.sms),
            tsMs: tsToMs(data.consent.ts) ?? undefined,
          }
        : undefined,
      answers: serializeFirestore(data.answers ?? {}),
      estimate: data.estimate ? serializeFirestore(data.estimate) : undefined,
      status: normalizeStatus(data.status),
      assignedTo: data.assignedTo ?? null,
      notes,
    };

    return NextResponse.json(detail);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
