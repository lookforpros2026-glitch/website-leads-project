import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data", "geo");
const TRACTS_FILE = path.join(DATA_DIR, "2023_gaz_tracts_06.txt");

const TARGET_COUNTIES: Array<{ countySlug: string; countyFips: string }> = [
  { countySlug: "los-angeles", countyFips: "037" },
  { countySlug: "orange", countyFips: "059" },
  { countySlug: "ventura", countyFips: "111" },
  { countySlug: "san-bernardino", countyFips: "071" },
];
const COUNTY_FIPS_TO_SLUG = new Map(TARGET_COUNTIES.map((c) => [c.countyFips, c.countySlug]));

function json(ok: boolean, payload: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ok, ...payload }, { status });
}

function extractCityCentroid(obj: any): { lat: number; lon: number } | null {
  if (typeof obj?.centroid?.lat === "number" && typeof obj?.centroid?.lng === "number") {
    return { lat: obj.centroid.lat, lon: obj.centroid.lng };
  }
  return null;
}

function parseTsv(raw: string) {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split("\t"));
}

function toNum(s: string | undefined | null) {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function chunkedCommit(db: FirebaseFirestore.Firestore, writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: any }>) {
  const chunkSize = 400;
  for (let i = 0; i < writes.length; i += chunkSize) {
    const batch = db.batch();
    writes.slice(i, i + chunkSize).forEach((w) => batch.set(w.ref, w.data, { merge: true }));
    await batch.commit();
  }
}

export async function POST() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return json(false, { error: auth.error }, auth.status);
    }

    const db = getAdminDb();

    const cfgRef = db.collection("config").doc("geo");
    const cfgSnap = await cfgRef.get();
    const cfg = cfgSnap.exists ? ((cfgSnap.data() as any) ?? {}) : {};

    const locked = cfgSnap.exists ? cfg.locked !== false : true;
    if (locked) {
      return json(false, { error: "GEO_LOCKED" }, 423);
    }

    if (!cfg.cityCentroidsReady) {
      return json(
        false,
        {
          error: "NO_CITY_CENTROIDS",
          hint: "Run POST /api/admin/geo/backfill-city-centroids-california first (geo must be unlocked).",
        },
        400
      );
    }

    try {
      await fs.access(TRACTS_FILE);
    } catch {
      return json(false, { error: "MISSING_TRACTS_FILE", expectedPath: TRACTS_FILE }, 400);
    }

    // Load cities only from target counties and require canonical centroid.
    const citySnap = await db.collection("geo_cities").where("state", "==", "CA").get();
    const citiesByCountySlug = new Map<string, Array<any>>();
    const missingSample: string[] = [];

    for (const d of citySnap.docs) {
      const data = d.data() as any;
      const countySlug = String(data?.countySlug || "");
      if (!TARGET_COUNTIES.some((c) => c.countySlug === countySlug)) continue;

      const centroid = extractCityCentroid(data);
      if (!centroid) {
        if (missingSample.length < 10) missingSample.push(d.id);
        continue;
      }

      const list = citiesByCountySlug.get(countySlug) || [];
      list.push({ id: d.id, ...data, __centroid: centroid });
      citiesByCountySlug.set(countySlug, list);
    }

    const usableCityCount = Array.from(citiesByCountySlug.values()).reduce((n, arr) => n + arr.length, 0);
    if (!usableCityCount) {
      return json(
        false,
        {
          error: "CENTROIDS_FLAG_SET_BUT_NO_CITY_COORDS",
          missingSample,
          hint: "Backfill must write geo_cities/{id}.centroid = {lat,lng}. Re-run backfill, then re-run import.",
        },
        500
      );
    }

    const raw = await fs.readFile(TRACTS_FILE, "utf8");
    const rows = parseTsv(raw);
    const header = rows.shift();
    if (!header || header[0] !== "USPS") {
      return json(false, { error: "TRACTS_PARSE_FAILED" }, 500);
    }

    const idx = (name: string) => header.findIndex((h) => h?.toUpperCase() === name.toUpperCase());
    const iUSPS = idx("USPS");
    const iGEOID = idx("GEOID");
    const iLAT = idx("INTPTLAT");
    const iLON = idx("INTPTLONG");

    const latIndex = iLAT >= 0 ? iLAT : Math.max(0, header.length - 2);
    const lonIndex = iLON >= 0 ? iLON : Math.max(0, header.length - 1);

    const writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: any }> = [];
    let imported = 0;
    let skipped = 0;
    let unmatched = 0;

    for (const r of rows) {
      const usps = r[iUSPS >= 0 ? iUSPS : 0];
      if (usps !== "CA") continue;

      const geoid = r[iGEOID >= 0 ? iGEOID : 1];
      const lat = toNum(r[latIndex]);
      const lon = toNum(r[lonIndex]);
      if (!geoid || lat == null || lon == null) continue;

      if (geoid.length < 5 || geoid.slice(0, 2) !== "06") continue;
      const countyFips3 = geoid.slice(2, 5);
      const countySlug = COUNTY_FIPS_TO_SLUG.get(countyFips3);
      if (!countySlug) continue;

      const candidates = citiesByCountySlug.get(countySlug) || [];
      if (!candidates.length) {
        unmatched += 1;
        continue;
      }

      let best: any = null;
      let bestDist = Number.POSITIVE_INFINITY;
      const pt = { lat, lon };

      for (const c of candidates) {
        const cPt = c.__centroid as { lat: number; lon: number } | null;
        if (!cPt) continue;
        const d = haversineKm(pt, cPt);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }

      if (!best) {
        unmatched += 1;
        continue;
      }

      const tractCode = geoid.slice(-6);
      const tractLabel = tractCode.length === 6 ? `${tractCode.slice(0, 4)}.${tractCode.slice(4)}` : tractCode;

      const neighborhoodName = `Tract ${tractLabel}`;
      const neighborhoodSlug = slugify(`tract-${tractLabel}`);

      const citySlug = best.citySlug || best.slug;
      if (!citySlug) {
        skipped += 1;
        continue;
      }

      const docId = `ca-${countySlug}-${citySlug}-${neighborhoodSlug}`;
      const ref = db.collection("geo_neighborhoods").doc(docId);

      writes.push({
        ref,
        data: {
          state: "CA",
          stateCode: "CA",
          stateId: "CA",

          countyId: best.countyId || null,
          countySlug,
          countyName: best.countyName || best.county || null,

          cityId: best.id,
          citySlug,
          cityName: best.cityName || best.name,

          neighborhoodName,
          name: neighborhoodName,
          neighborhoodSlug,
          slug: neighborhoodSlug,

          tractGeoid: geoid,
          countyFips: `06${countyFips3}`,
          source: "tract",
          sourceDetail: "gazetteer_tracts_2023",

          lat,
          lon,
          centroid: { lat, lng: lon },

          search: `${neighborhoodName} ${best.cityName || best.name} ${best.countyName || ""} CA`.trim().toLowerCase(),
        },
      });

      imported += 1;
    }

    await chunkedCommit(db, writes);

    await cfgRef.set(
      { locked: true, lockedAt: Timestamp.now(), lockedBy: auth.email || auth.uid || "admin" },
      { merge: true }
    );

    return json(true, { imported, skipped, unmatched, counties: TARGET_COUNTIES.map((c) => c.countySlug) }, 200);
  } catch (err: any) {
    console.error("Import neighborhoods failed", err);
    return NextResponse.json({ ok: false, error: err?.message || "Import failed", stack: err?.stack || null }, { status: 500 });
  }
}

