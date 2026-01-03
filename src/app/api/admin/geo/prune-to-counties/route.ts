import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

export const runtime = "nodejs";

const DEFAULT_ALLOWED_COUNTY_SLUGS = ["los-angeles", "orange", "ventura", "san-bernardino"];

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

async function deleteByPredicate(
  db: FirebaseFirestore.Firestore,
  writer: FirebaseFirestore.BulkWriter,
  collectionName: string,
  shouldDelete: (doc: FirebaseFirestore.QueryDocumentSnapshot) => boolean
) {
  let deleted = 0;
  let kept = 0;

  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  const pageSize = 500;

  while (true) {
    let q = db.collection(collectionName).orderBy("__name__").limit(pageSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      if (shouldDelete(doc)) {
        writer.delete(doc.ref);
        deleted += 1;
      } else {
        kept += 1;
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return { deleted, kept };
}

export async function POST() {
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

    const allow = new Set<string>(DEFAULT_ALLOWED_COUNTY_SLUGS);

    const writer = db.bulkWriter();
    let failed = 0;
    let lastWriteError: any = null;

    writer.onWriteError((err) => {
      failed += 1;
      lastWriteError = { message: err.message, code: (err as any).code, failedAttempts: err.failedAttempts };
      return false;
    });

    const counties = await deleteByPredicate(db, writer, "geo_counties", (doc) => {
      const data = doc.data() as any;
      const slug = String(data?.countySlug || data?.slug || getCountySlugFromId(doc.id));
      return !allow.has(slug);
    });

    const cities = await deleteByPredicate(db, writer, "geo_cities", (doc) => {
      const data = doc.data() as any;
      const slug = String(data?.countySlug || "");
      return slug ? !allow.has(slug) : true;
    });

    const neighborhoods = await deleteByPredicate(db, writer, "geo_neighborhoods", (doc) => {
      const data = doc.data() as any;
      const slug = String(data?.countySlug || "");
      return slug ? !allow.has(slug) : true;
    });

    let pagesSkipped = 0;
    const pages = await deleteByPredicate(db, writer, "pages", (doc) => {
      const data = doc.data() as any;
      const slug = extractPageCountySlug(data);
      if (!slug) {
        pagesSkipped += 1;
        return false;
      }
      return !allow.has(slug);
    });

    await writer.close();

    if (failed > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "WRITE_FAILED",
          lastWriteError,
          failed,
          deleted: { counties: counties.deleted, cities: cities.deleted, neighborhoods: neighborhoods.deleted, pages: pages.deleted },
          kept: { counties: counties.kept, cities: cities.kept, neighborhoods: neighborhoods.kept, pages: pages.kept },
          skipped: { pages: pagesSkipped },
          allowedCountySlugs: Array.from(allow),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        deleted: { counties: counties.deleted, cities: cities.deleted, neighborhoods: neighborhoods.deleted, pages: pages.deleted },
        kept: { counties: counties.kept, cities: cities.kept, neighborhoods: neighborhoods.kept, pages: pages.kept },
        skipped: { pages: pagesSkipped },
        allowedCountySlugs: Array.from(allow),
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "PRUNE_FAILED", stack: err?.stack || null }, { status: 500 });
  }
}


