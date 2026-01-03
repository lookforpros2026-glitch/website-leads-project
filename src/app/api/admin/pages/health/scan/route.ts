import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { createHash } from "crypto";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";
import {
  MIN_LENGTHS,
  PAGE_HEALTH_VERSION,
  REQUIRED_SECTIONS,
  QARuleCode,
} from "@/lib/pageHealthRules";

type ScanScope = "all" | "serviceKey" | "zip" | "pageIds";

type QAFail = { code: QARuleCode; msg: string; severity: "warn" | "fail" };

function normalizeText(input: string, stopWords: string[]) {
  const lowered = input.toLowerCase();
  const scrubbed = stopWords.reduce((acc, word) => {
    if (!word) return acc;
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return acc.replace(new RegExp(`\\b${escaped}\\b`, "g"), " ");
  }, lowered);
  const cleaned = scrubbed.replace(/[^a-z0-9\\s]/g, " ");
  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t && !/^\d+$/.test(t));
  return tokens.join(" ").replace(/\s+/g, " ").trim();
}

function hashText(input: string) {
  return createHash("sha1").update(input, "utf8").digest("hex");
}

function extractSectionText(page: any, key: string) {
  const content = page?.content || page?.sections || {};
  if (key === "hero") {
    return [content.headline, content.subheadline, content.h1].filter(Boolean).join(" ");
  }
  if (key === "faqs") {
    const faqs = Array.isArray(content.faqs) ? content.faqs : [];
    return faqs
      .map((f: any) => [f?.q, f?.question, f?.a, f?.answer].filter(Boolean).join(" "))
      .join(" ");
  }
  if (key === "cta") {
    const ctas = Array.isArray(content.ctas) ? content.ctas : [];
    return ctas.map((c: any) => [c?.title, c?.text, c?.body].filter(Boolean).join(" ")).join(" ");
  }
  const direct = content?.[key];
  if (typeof direct === "string") return direct;
  if (direct && typeof direct === "object") {
    return [direct.title, direct.subtitle, direct.body, direct.text].filter(Boolean).join(" ");
  }
  if (Array.isArray(content?.sections)) {
    return content.sections
      .map((s: any) => [s?.title, s?.headline, s?.body, s?.text].filter(Boolean).join(" "))
      .join(" ");
  }
  return "";
}

function detectQAFails(page: any, sectionTextByKey: Record<string, string>) {
  const fails: QAFail[] = [];
  const content = page?.content || {};
  const title = page?.seo?.title || page?.title;
  const h1 = content?.h1 || page?.h1;
  const slugPath = page?.slugPath || page?.slug;
  const faqs = Array.isArray(content?.faqs) ? content.faqs : [];
  const schemaJsonLd =
    content?.schemaJsonLd ||
    content?.schema ||
    page?.schemaJsonLd ||
    page?.service?.name ||
    page?.serviceName;
  const totalLen = Object.values(sectionTextByKey).join(" ").length;

  if (!title) fails.push({ code: "missing_title", msg: "Missing SEO title.", severity: "fail" });
  if (!h1) fails.push({ code: "missing_h1", msg: "Missing H1.", severity: "fail" });
  if (!slugPath || !/^\/[^\s]+$/.test(String(slugPath))) {
    fails.push({ code: "slug_invalid", msg: "Slug path is invalid.", severity: "fail" });
  }
  if (faqs.length === 0) {
    fails.push({ code: "missing_faq", msg: "FAQ section missing.", severity: "warn" });
  } else if (faqs.length < 3) {
    fails.push({ code: "faqs_too_few", msg: "FAQ count below minimum.", severity: "warn" });
  }
  if (!schemaJsonLd) {
    fails.push({ code: "missing_schema", msg: "Schema markup missing.", severity: "warn" });
  }
  if (totalLen > 0 && totalLen < 1200) {
    fails.push({ code: "content_too_short", msg: "Overall content too short.", severity: "warn" });
  }

  const minKeys = Object.keys(MIN_LENGTHS);
  minKeys.forEach((key) => {
    const minLen = MIN_LENGTHS[key] ?? 0;
    const len = (sectionTextByKey[key] || "").length;
    if (minLen > 0 && len > 0 && len < minLen) {
      fails.push({ code: "content_too_short", msg: `${key} below ${minLen} chars.`, severity: "warn" });
    }
  });

  const seen = new Set<string>();
  return fails.filter((f) => {
    const k = `${f.code}-${f.msg}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function scoreHealth(missingCount: number, qaFails: QAFail[], duplicateCount: number) {
  let score = 100;
  score -= missingCount * 12;
  qaFails.forEach((f) => {
    score -= f.severity === "fail" ? 15 : 6;
  });
  score -= duplicateCount * 4;
  return Math.max(0, Math.min(100, score));
}

async function updateFingerprintIndex(params: {
  db: FirebaseFirestore.Firestore;
  serviceKey: string;
  sectionKey: string;
  fingerprint: string;
  pageId: string;
}) {
  const { db, serviceKey, sectionKey, fingerprint, pageId } = params;
  const docId = `${serviceKey}_${sectionKey}_${fingerprint}`;
  const ref = db.collection("page_fingerprints").doc(docId);
  const snap = await ref.get();
  const data = snap.exists ? (snap.data() as any) : null;
  const existingIds: string[] = Array.isArray(data?.pageIds) ? data.pageIds : [];
  const hasPage = existingIds.includes(pageId);
  const nextIds = hasPage ? existingIds : [...existingIds, pageId].slice(0, 50);
  const nextCount = typeof data?.count === "number" ? data.count + (hasPage ? 0 : 1) : 1;

  await ref.set(
    {
      serviceKey,
      sectionKey,
      fingerprint,
      pageIds: nextIds,
      count: nextCount,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );

  return { count: nextCount, samplePageIds: nextIds };
}

async function runScanJob(jobId: string, scope: ScanScope, params: any) {
  const db = getAdminDb();
  const jobRef = db.collection("page_health_jobs").doc(jobId);
  const now = Timestamp.now();

  let baseQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> | null = null;
  if (scope === "all") {
    baseQuery = db.collection("pages").orderBy("__name__");
  } else if (scope === "serviceKey") {
    baseQuery = db.collection("pages").where("service.key", "==", params.serviceKey).orderBy("__name__");
  } else if (scope === "zip") {
    baseQuery = db.collection("pages").where("zip", "==", params.zip).orderBy("__name__");
  }

  const pageIds: string[] =
    scope === "pageIds" && Array.isArray(params.pageIds) ? params.pageIds.filter((id: any) => typeof id === "string") : [];

  let total = pageIds.length;
  if (baseQuery) {
    const countSnap = await baseQuery.count().get();
    total = countSnap.data().count || 0;
  }

  await jobRef.set(
    {
      status: "running",
      progress: { done: 0, total, percent: total ? 0 : 100 },
      updatedAt: now,
    },
    { merge: true }
  );

  let done = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | null = null;
  let scanned = 0;
  let updated = 0;
  let warnCount = 0;
  let failCount = 0;

  async function processPage(page: any) {
    const serviceKey = page?.service?.key || page?.serviceKey || page?.serviceSlug || "unknown";
    const stopWords = [
      page?.zip,
      page?.placeName,
      page?.city?.name,
      page?.county?.name,
      page?.countyName,
      page?.service?.name,
      serviceKey,
    ]
      .map((v) => (typeof v === "string" ? v.toLowerCase() : ""))
      .filter(Boolean);

    const sectionTextByKey: Record<string, string> = {};
    REQUIRED_SECTIONS.forEach((key) => {
      sectionTextByKey[key] = extractSectionText(page, key);
    });

    const missingRequired = REQUIRED_SECTIONS.filter((key) => !sectionTextByKey[key] || sectionTextByKey[key].trim().length === 0);
    const qaFails = detectQAFails(page, sectionTextByKey);
    const fingerprints: Array<{ sectionKey: string; fingerprint: string; scopeKey?: string }> = REQUIRED_SECTIONS.map((key) => {
      const raw = sectionTextByKey[key] || "";
      const normalized = normalizeText(raw, stopWords);
      return { sectionKey: key, fingerprint: normalized ? hashText(normalized) : "", scopeKey: serviceKey };
    }).filter((f) => f.fingerprint);
    const slugPath = page?.slugPath || page?.slug || "";
    if (slugPath) {
      fingerprints.push({
        sectionKey: "slugPath",
        fingerprint: hashText(String(slugPath).trim().toLowerCase()),
        scopeKey: "global",
      });
    }

    const duplicates: Array<{
      sectionKey: string;
      fingerprint: string;
      sameServiceCount: number;
      samplePageIds: string[];
    }> = [];
    const dupSectionKeys: string[] = [];

    for (const fp of fingerprints) {
      const idx = await updateFingerprintIndex({
        db,
        serviceKey: fp.scopeKey || serviceKey,
        sectionKey: fp.sectionKey,
        fingerprint: fp.fingerprint,
        pageId: page.id,
      });
      if (idx.count > 1) {
        duplicates.push({
          sectionKey: fp.sectionKey,
          fingerprint: fp.fingerprint,
          sameServiceCount: idx.count,
          samplePageIds: idx.samplePageIds,
        });
        dupSectionKeys.push(fp.sectionKey);
      }
    }

    const missingCount = missingRequired.length;
    const qaFailCount = qaFails.length;
    const duplicateCount = duplicates.length;
    const hasFail = missingCount > 0 || qaFails.some((f) => f.severity === "fail");
    const hasWarn = !hasFail && (qaFails.some((f) => f.severity === "warn") || duplicateCount > 0);
    const status = hasFail ? "fail" : hasWarn ? "warn" : "ok";
    const score = scoreHealth(missingCount, qaFails, duplicateCount);

    await db.collection("pages").doc(page.id).set(
      {
        health: {
          scannedAt: Timestamp.now(),
          version: PAGE_HEALTH_VERSION,
          status,
          missingRequired,
          qaFails,
          duplicates,
          score,
          summary: {
            missingCount,
            duplicateCount,
            qaFailCount,
          },
        },
        healthStatus: status,
        missingCount,
        duplicateCount,
        qaFailCount,
        healthMissingSections: missingRequired,
        healthDuplicateSections: dupSectionKeys,
      },
      { merge: true }
    );

    if (status === "warn") warnCount += 1;
    if (status === "fail") failCount += 1;
    updated += 1;
  }

  if (scope === "pageIds") {
    const chunkSize = 100;
    for (let i = 0; i < pageIds.length; i += chunkSize) {
      const chunk = pageIds.slice(i, i + chunkSize);
      const snaps = await db.getAll(...chunk.map((id) => db.collection("pages").doc(id)));
      for (const snap of snaps) {
        if (!snap.exists) continue;
        scanned += 1;
        await processPage({ id: snap.id, ...(snap.data() as any) });
        done += 1;
      }
      await jobRef.set(
        {
          progress: { done, total, percent: total ? Math.round((done / total) * 100) : 100 },
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );
    }
  } else if (baseQuery) {
    const batchSize = 200;
    while (true) {
      let q = baseQuery.limit(batchSize);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;
      for (const doc of snap.docs) {
        scanned += 1;
        await processPage({ id: doc.id, ...(doc.data() as any) });
        done += 1;
      }
      lastDoc = snap.docs[snap.docs.length - 1] || null;
      await jobRef.set(
        {
          progress: { done, total, percent: total ? Math.round((done / total) * 100) : 100 },
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );
    }
  }

  await jobRef.set(
    {
      status: "succeeded",
      updatedAt: Timestamp.now(),
      output: { scanned, updated, warns: warnCount, fails: failCount },
      progress: { done, total, percent: total ? Math.round((done / total) * 100) : 100 },
    },
    { merge: true }
  );
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
  }

  const body = (await req.json().catch(() => null)) as any;
  const scope: ScanScope = body?.scope || "all";
  if (!["all", "serviceKey", "zip", "pageIds"].includes(scope)) {
    return NextResponse.json({ ok: false, error: "invalid_scope" }, { status: 400 });
  }

  const db = getAdminDb();
  const jobRef = db.collection("page_health_jobs").doc();
  const now = Timestamp.now();
  await jobRef.set({
    type: "page_health_scan",
    status: "queued",
    createdAt: now,
    updatedAt: now,
    input: {
      scope,
      serviceKey: body?.serviceKey || null,
      zip: body?.zip || null,
      pageIds: Array.isArray(body?.pageIds) ? body.pageIds.slice(0, 5000) : null,
    },
    progress: { done: 0, total: 0, percent: 0 },
  });

  void runScanJob(jobRef.id, scope, body);

  return NextResponse.json({ ok: true, jobId: jobRef.id });
}
