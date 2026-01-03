import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { LeadPayloadSchema } from "@/lib/validators/lead";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeEmail, normalizePhone, sha256 } from "@/lib/hash";
import { getSiteSettings } from "@/lib/settings";

function getClientIp(req: NextRequest) {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

function dedupKey(windowDays: number) {
  const ms = Date.now();
  const windowMs = Math.max(1, windowDays) * 24 * 60 * 60 * 1000;
  return String(Math.floor(ms / windowMs));
}

function bad(field: string, reason: string, extra?: any) {
  return NextResponse.json(
    { ok: false, error: "invalid_payload", field, reason, ...(extra ? { extra } : {}) },
    { status: 400 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit(`leads:${ip}`, 20, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: "rate_limited", resetAt: rl.resetAt }, { status: 429 });
    }

    const settings = await getSiteSettings();
    const leadSettings = settings.leads;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return bad("body", "not_object");
    }
    console.log("[/api/leads] payload keys:", Object.keys(body || {}));

    const pageSlug = String(body.pageSlug || body.slug || body.slugPath || body.pagePath || "").trim();
    const fullName = String(body.fullName || "").trim();
    const phone = String(body.phone || "").trim();
    const phoneDigits = phone.replace(/\D/g, "");
    const email = body.email == null ? "" : body.email;
    const message = body.message == null ? "" : body.message;
    const answers = body.answers ?? body.form ?? body.responses ?? null;
    const hp = typeof body.hp === "string" ? body.hp : undefined;
    const utm = body.utm && typeof body.utm === "object" ? body.utm : undefined;
    const referrer = typeof body.referrer === "string" ? body.referrer : undefined;
    const slugPath = String(body.slugPath || "").trim();
    const pagePath = String(body.pagePath || slugPath || "").trim();
    const gclid = typeof body.gclid === "string" ? body.gclid : "";
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const countySlug = typeof body.countySlug === "string" ? body.countySlug : "";
    const citySlug = typeof body.citySlug === "string" ? body.citySlug : "";
    const zip = typeof body.zip === "string" ? body.zip : "";
    const estimatorVersion = typeof body.estimatorVersion === "string" ? body.estimatorVersion : undefined;
    const estimatorConfigId = typeof body.estimatorConfigId === "string" ? body.estimatorConfigId : undefined;

    if (!pageSlug) return bad("pageSlug", "required_string");
    if (!fullName) return bad("fullName", "required_string");
    if (leadSettings.requirePhone && (!phoneDigits || phoneDigits.length < 10)) return bad("phone", "invalid_phone");
    if (!leadSettings.requirePhone && phoneDigits.length > 0 && phoneDigits.length < 10) return bad("phone", "invalid_phone");
    if (typeof email !== "string") return bad("email", "must_be_string");
    if (leadSettings.requireEmail && !email.trim()) return bad("email", "required_string");
    if (typeof message !== "string") return bad("message", "must_be_string");
    if (leadSettings.minMessageLength > 0 && message.trim().length < leadSettings.minMessageLength) {
      return bad("message", "too_short", { min: leadSettings.minMessageLength });
    }
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) return bad("answers", "required_object");

    if (slugPath && typeof slugPath !== "string") return bad("slugPath", "must_be_string");

    const normalizedPayload = {
      pageSlug,
      pagePath,
      sessionId,
      fullName,
      phone,
      email,
      message,
      answers,
      hp,
      gclid,
      serviceKey: typeof body.serviceKey === "string" ? body.serviceKey : undefined,
      countySlug,
      citySlug,
      zip,
      utm,
      referrer,
    };

    const parsed = LeadPayloadSchema.safeParse(normalizedPayload);
    if (!parsed.success) {
      return bad("payload", "schema_failed", parsed.error.flatten());
    }
    const payload = parsed.data;

    // Honeypot: silently accept but do not write
    if (payload.hp && payload.hp.trim().length > 0) {
      return NextResponse.json({ ok: true });
    }

    const phoneNorm = normalizePhone(payload.phone);
    const emailNorm = normalizeEmail(payload.email);

    const idem = sha256(
      [payload.pageSlug.trim().toLowerCase(), phoneNorm, emailNorm, dedupKey(leadSettings.dedupWindowDays)].join("|")
    );

    const db = getAdminDb();
    const ref = db.collection("leads").doc(idem);
    if (leadSettings.dedupEnabled) {
      const snap = await ref.get();
      if (snap.exists) {
        return NextResponse.json({ ok: true, deduped: true });
      }
    }

    const estimate = body.estimate && typeof body.estimate === "object" ? body.estimate : {};
    const estimateMin = typeof estimate.min === "number" ? estimate.min : typeof estimate.low === "number" ? estimate.low : null;
    const estimateMax = typeof estimate.max === "number" ? estimate.max : typeof estimate.high === "number" ? estimate.high : null;
    const estimateMid =
      typeof estimate.typical === "number"
        ? estimate.typical
        : typeof estimateMin === "number" && typeof estimateMax === "number"
        ? Math.round((estimateMin + estimateMax) / 2)
        : null;
    const estimateConfidence = typeof estimate.confidence === "string" ? estimate.confidence : null;
    const serviceKey =
      typeof estimate.serviceKey === "string"
        ? estimate.serviceKey
        : typeof body.serviceKey === "string"
        ? body.serviceKey
        : typeof body.service === "string"
        ? body.service
        : "";
    const serviceName = typeof estimate.serviceName === "string" ? estimate.serviceName : "";
    const durationMinDays = typeof body.durationMinDays === "number" ? body.durationMinDays : null;
    const durationMaxDays = typeof body.durationMaxDays === "number" ? body.durationMaxDays : null;
    const sourceDocId = typeof body.source?.docId === "string" ? body.source.docId : undefined;
    const sourceUrl = typeof body.source?.url === "string" ? body.source.url : undefined;
    const sourceType = typeof body.source?.type === "string" ? body.source.type : undefined;

    const now = Timestamp.now();
    await ref.create({
      id: idem,
      pageSlug: payload.pageSlug,
      slugPath: slugPath || payload.pageSlug,
      pagePath: pagePath || slugPath || payload.pageSlug,
      fullName: payload.fullName,
      phone: payload.phone,
      phoneNorm,
      email: payload.email ?? null,
      emailNorm: emailNorm || null,
      message: payload.message ?? null,
      answers: payload.answers ?? null,
      estimateMin,
      estimateMax,
      estimateMid,
      estimateConfidence,
      durationMinDays,
      durationMaxDays,
      serviceKey: serviceKey || null,
      countySlug: countySlug || null,
      citySlug: citySlug || null,
      zip: zip || null,
      serviceName: serviceName || null,
      estimatorVersion: estimatorVersion ?? null,
      estimatorConfigId: estimatorConfigId ?? null,
      status: leadSettings.defaultStatus || "new",
      utm: payload.utm ?? null,
      utm_source: payload.utm?.source ?? null,
      utm_medium: payload.utm?.medium ?? null,
      utm_campaign: payload.utm?.campaign ?? null,
      utm_term: payload.utm?.term ?? null,
      utm_content: payload.utm?.content ?? null,
      gclid: gclid || null,
      sessionId: sessionId || null,
      referrer: payload.referrer ?? req.headers.get("referer") ?? null,
      source:
        sourceType || sourceDocId || sourceUrl
          ? {
              type: sourceType || "programmatic",
              docId: sourceDocId,
              url: sourceUrl,
            }
          : null,
      userAgent: req.headers.get("user-agent") ?? null,
      ip,
      ipHash: sha256(ip),
      createdAt: now,
      updatedAt: now,
    });

    // Lead notifications are not queued in Firestore jobs.

    return NextResponse.json({ ok: true, id: idem });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "server_error", detail: err?.message ?? String(err) }, { status: 500 });
  }
}
