import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data", "geo");
const PLACE_FILE = path.join(DATA_DIR, "2023_Gaz_place_national.txt");
const CROSSWALK_FILE = path.join(DATA_DIR, "st06_ca_places.txt");

const ALLOWED_COUNTY_SLUGS = new Set(["los-angeles", "orange", "ventura", "san-bernardino"]);

// PLACE file columns (gazetteer record layouts): USPS, GEOID, GEOIDFQ, ANSICODE, NAME, LSAD, FUNCSTAT, ALAND, AWATER, ALAND_SQMI, AWATER_SQMI, INTPTLAT, INTPTLONG
// Record layout reference. :contentReference[oaicite:2]{index=2}

function cleanCountyName(name: string) {
  return name.replace(/ County.*/i, "").trim();
}

function cleanCityName(name: string) {
  return name
    .replace(/\s+(city|town|cdp|municipality|village)\b.*$/i, "")
    .replace(/\s+\(balance\)$/i, "")
    .trim();
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

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const db = getAdminDb();

  try {
    // Require geo unlocked (same rule as your import)
    const cfgSnap = await db.collection("config").doc("geo").get();
    const locked = cfgSnap.exists ? (cfgSnap.data() as any).locked !== false : true;
    if (locked) {
      return NextResponse.json({ ok: false, error: "GEO_LOCKED" }, { status: 423 });
    }

    // Ensure files exist
    try {
      await fs.access(PLACE_FILE);
      await fs.access(CROSSWALK_FILE);
    } catch {
      return NextResponse.json(
        { ok: false, error: "MISSING_FILES", expectedPaths: [PLACE_FILE, CROSSWALK_FILE] },
        { status: 500 }
      );
    }

    const [placeRaw, crosswalkRaw] = await Promise.all([
      fs.readFile(PLACE_FILE, "utf8"),
      fs.readFile(CROSSWALK_FILE, "utf8"),
    ]);

    // Build GEOID -> countyName crosswalk (from your existing approach)
    const geoidToCounty = new Map<string, string>();
    crosswalkRaw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line) => {
        const parts = line.split("|");
        // parts[1]=stateFips, parts[2]=placeFips, parts[6]=county name (per your existing file format)
        if (parts.length >= 7 && parts[1] === "06") {
          const geoid = `${parts[1]}${parts[2]}`;
          const countyName = parts[6]?.trim();
          if (countyName) geoidToCounty.set(geoid, countyName);
        }
      });

    const rows = parseTsv(placeRaw);
    const header = rows.shift();
    if (!header || header[0] !== "USPS") {
      return NextResponse.json({ ok: false, error: "PLACE_PARSE_FAILED" }, { status: 500 });
    }

    const idx = (name: string) => header.findIndex((h) => h?.toUpperCase() === name.toUpperCase());
    const iUSPS = idx("USPS"); // 0
    const iGEOID = idx("GEOID"); // 1
    const iNAME = idx("NAME"); // 3 in your local file
    const iLAT = idx("INTPTLAT");
    const iLON = idx("INTPTLONG");

    if (iGEOID < 0 || iNAME < 0 || iLAT < 0 || iLON < 0) {
      return NextResponse.json({ ok: false, error: "PLACE_HEADER_UNEXPECTED", header }, { status: 500 });
    }

    // Build map: cityDocId -> {lat,lon}
    const coordByKey = new Map<string, { lat: number; lon: number }>();

    for (const r of rows) {
      const usps = r[iUSPS >= 0 ? iUSPS : 0];
      if (usps !== "CA") continue;

      const geoid = r[iGEOID];
      const rawName = r[iNAME]; // NAME
      const cityName = cleanCityName(rawName);
      const citySlug = slugify(cityName);

      const countyNameRaw = geoid ? geoidToCounty.get(geoid) ?? null : null;
      if (!countyNameRaw) continue;
      const countySlug = slugify(cleanCountyName(countyNameRaw));
      if (!ALLOWED_COUNTY_SLUGS.has(countySlug)) continue;

      const lat = toNum(r[iLAT]); // INTPTLAT
      const lon = toNum(r[iLON]); // INTPTLONG
      if (lat == null || lon == null) continue;

      // Your geo_cities ids are like: ca-{countySlug}-{citySlug}
      const docId = `ca-${countySlug}-${citySlug}`;
      coordByKey.set(docId, { lat, lon });
    }

    // Update existing geo_cities docs (only 3 counties)
    const citySnap = await db.collection("geo_cities").where("state", "==", "CA").get();
    const cityDocs = citySnap.docs.filter((d) => ALLOWED_COUNTY_SLUGS.has(String((d.data() as any)?.countySlug || "")));

    const scanned = cityDocs.length;
    let written = 0;
    let skipped = 0;

    const batchSize = 400;
    let batch = db.batch();
    let ops = 0;

    try {
      for (const doc of cityDocs) {
        const coords = coordByKey.get(doc.id);
        if (!coords) {
          skipped += 1;
          continue;
        }

        batch.set(
          doc.ref,
          {
            lat: coords.lat,
            lon: coords.lon,
            centroid: { lat: coords.lat, lng: coords.lon },
            centroidUpdatedAt: new Date().toISOString(),
            centroidUpdatedAtMs: Date.now(),
          },
          { merge: true }
        );
        written += 1;
        ops += 1;

        if (ops >= batchSize) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }

      if (ops > 0) await batch.commit();
    } catch (err: any) {
      return NextResponse.json(
        { ok: false, error: "WRITE_FAILED", detail: err?.message || String(err), scanned, written, skipped, failed: 1 },
        { status: 500 }
      );
    }

    await db.collection("config").doc("geo").set(
      {
        cityCentroidsReady: written > 0,
        cityCentroidsReadyAt: written > 0 ? new Date().toISOString() : null,
        cityCentroidsReadyAtMs: written > 0 ? Date.now() : null,
        cityCentroidsUpdated: written,
        cityCentroidsMissing: skipped,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, scanned, written, skipped, failed: 0 }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "BACKFILL_FAILED", stack: err?.stack || null },
      { status: 500 }
    );
  }
}

