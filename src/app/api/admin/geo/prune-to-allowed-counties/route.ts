import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

export const runtime = "nodejs";

const DEFAULT_ALLOWED_COUNTY_SLUGS = ["los-angeles", "orange", "ventura", "san-bernardino"];
const COLLECTIONS = ["geo_counties", "geo_cities", "geo_neighborhoods", "pages"] as const;
type CollectionName = (typeof COLLECTIONS)[number];

type Cursor = { collection: CollectionName; lastDocId: string | null };

function getCountySlugFromId(id: string) {
  return id.replace(/^ca-/, "");
}

function extractPageCountySlug(data: any): string | null {
  const direct =
    (typeof data?.countySlug === "string" && data.countySlug) ||
    (typeof data?.county?.slug === "string" && data.county.slug) ||
    (typeof data?.county?.countySlug === "string" && data.county.countySlug) ||
    null;
  if (direct) return direct;

  if (typeof data?.slugPath === "string" && data.slugPath) {
    const seg = data.slugPath.split("/").filter(Boolean)[0];
    return seg || null;
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitteredSleepMs(baseMs: number) {
  if (!Number.isFinite(baseMs) || baseMs <= 0) return 0;
  const min = Math.max(0, Math.floor(baseMs * 0.7));
  const max = Math.max(min, Math.ceil(baseMs * 1.3));
  return Math.floor(min + Math.random() * (max - min + 1));
}

function toInt(value: any, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeCursor(input: any): Cursor | null {
  if (!input || typeof input !== "object") return null;
  const collection = String((input as any).collection || "") as CollectionName;
  if (!COLLECTIONS.includes(collection)) return null;
  const lastDocIdRaw = (input as any).lastDocId;
  const lastDocId = typeof lastDocIdRaw === "string" && lastDocIdRaw.trim() ? lastDocIdRaw.trim() : null;
  return { collection, lastDocId };
}

function shouldDeleteDoc(collection: CollectionName, docId: string, data: any, allow: Set<string>) {
  if (collection === "geo_counties") {
    const slug = String(data?.countySlug || data?.slug || getCountySlugFromId(docId));
    return !allow.has(slug);
  }

  if (collection === "geo_cities" || collection === "geo_neighborhoods") {
    const slug = String(data?.countySlug || "");
    return slug ? !allow.has(slug) : true;
  }

  if (collection === "pages") {
    const slug = extractPageCountySlug(data);
    if (!slug) return null; // unknown; keep
    return !allow.has(slug);
  }

  return false;
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const db = getAdminDb();

  try {
    const cfgRef = db.collection("config").doc("geo");
    const cfgSnap = await cfgRef.get();
    const cfg = cfgSnap.exists ? ((cfgSnap.data() as any) ?? {}) : {};
    const locked = cfgSnap.exists ? cfg.locked !== false : true;
    if (locked) {
      return NextResponse.json({ ok: false, error: "GEO_LOCKED" }, { status: 423 });
    }

    const url = new URL(req.url);
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    const allowedFromBody = Array.isArray(body?.allowedCountySlugs) ? body.allowedCountySlugs : null;
    const allowedCountySlugs: string[] =
      allowedFromBody && allowedFromBody.length
        ? allowedFromBody.map((s: any) => String(s))
        : Array.isArray(cfg.allowedCountySlugs) && cfg.allowedCountySlugs.length
          ? cfg.allowedCountySlugs.map((s: any) => String(s))
          : DEFAULT_ALLOWED_COUNTY_SLUGS;
    const allow = new Set<string>(allowedCountySlugs.map((slug: string) => slug.toLowerCase()));

    const batchSize = clamp(toInt(body?.batchSize ?? url.searchParams.get("batchSize"), 200), 1, 450);
    const baseSleepMs = clamp(toInt(body?.sleepMs ?? url.searchParams.get("sleepMs"), 350), 0, 5000);
    const maxCommits = clamp(toInt(body?.maxCommits ?? url.searchParams.get("maxCommits"), Number.MAX_SAFE_INTEGER), 1, Number.MAX_SAFE_INTEGER);

    const initialCursor =
      normalizeCursor(body?.cursor) ||
      normalizeCursor({
        collection: url.searchParams.get("collection"),
        lastDocId: url.searchParams.get("lastDocId"),
      }) ||
      ({ collection: "geo_counties", lastDocId: null } as Cursor);

    const deleted: Record<string, number> = { geo_counties: 0, geo_cities: 0, geo_neighborhoods: 0, pages: 0 };
    const kept: Record<string, number> = { geo_counties: 0, geo_cities: 0, geo_neighborhoods: 0, pages: 0 };
    let pagesSkippedUndetermined = 0;
    let commits = 0;

    const startIndex = COLLECTIONS.indexOf(initialCursor.collection);
    if (startIndex < 0) {
      return NextResponse.json({ ok: false, error: "INVALID_CURSOR", allowedCollections: COLLECTIONS }, { status: 400 });
    }

    for (let ci = startIndex; ci < COLLECTIONS.length; ci += 1) {
      const collection = COLLECTIONS[ci];
      let lastDocId: string | null = ci === startIndex ? initialCursor.lastDocId : null;

      while (true) {
        const pageSize = 500;
        let q = db.collection(collection).orderBy("__name__").limit(pageSize);
        if (lastDocId) q = q.startAfter(db.collection(collection).doc(lastDocId));

        const snap = await q.get();
        if (snap.empty) break;

        let batch = db.batch();
        let batchDeletes = 0;
        let lastSeenId = lastDocId;

        for (const doc of snap.docs) {
          lastSeenId = doc.id;
          const decision = shouldDeleteDoc(collection, doc.id, doc.data(), allow);

          if (collection === "pages" && decision === null) {
            pagesSkippedUndetermined += 1;
            kept[collection] += 1;
            continue;
          }

          if (decision) {
            batch.delete(doc.ref);
            deleted[collection] += 1;
            batchDeletes += 1;
          } else {
            kept[collection] += 1;
          }

          if (batchDeletes >= batchSize) {
            await batch.commit();
            commits += 1;
            const delay = jitteredSleepMs(baseSleepMs);
            if (delay) await sleep(delay);

            if (commits >= maxCommits) {
              return NextResponse.json(
                {
                  ok: true,
                  done: false,
                  allowedCountySlugs: Array.from(allow),
                  deleted,
                  kept,
                  skipped: { pagesUndetermined: pagesSkippedUndetermined },
                  batchSize,
                  sleepMs: baseSleepMs,
                  commits,
                  cursor: { collection, lastDocId: lastSeenId },
                },
                { status: 200 }
              );
            }

            batch = db.batch();
            batchDeletes = 0;
          }
        }

        if (batchDeletes > 0) {
          await batch.commit();
          commits += 1;
          const delay = jitteredSleepMs(baseSleepMs);
          if (delay) await sleep(delay);

          if (commits >= maxCommits) {
            return NextResponse.json(
              {
                ok: true,
                done: false,
                allowedCountySlugs: Array.from(allow),
                deleted,
                kept,
                skipped: { pagesUndetermined: pagesSkippedUndetermined },
                batchSize,
                sleepMs: baseSleepMs,
                commits,
                cursor: { collection, lastDocId: lastSeenId },
              },
              { status: 200 }
            );
          }
        }

        lastDocId = lastSeenId;
        if (snap.docs.length < pageSize) break;
      }
    }

    return NextResponse.json(
      {
        ok: true,
        done: true,
        allowedCountySlugs: Array.from(allow),
        deleted,
        kept,
        skipped: { pagesUndetermined: pagesSkippedUndetermined },
        batchSize,
        sleepMs: baseSleepMs,
        commits,
        cursor: null,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "PRUNE_FAILED", stack: err?.stack || null }, { status: 500 });
  }
}

