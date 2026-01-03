import { Timestamp } from "firebase-admin/firestore";
import { slugify } from "@/lib/slug";

type ZipRow = {
  zip: string;
  place: string;
  county: string;
  state: string;
  lat?: string;
  lng?: string;
  countySlug?: string;
};

const COUNTY_SLUG_BY_NAME: Record<string, string> = {
  "los angeles": "los-angeles",
  "orange": "orange",
  "ventura": "ventura",
  "san bernardino": "san-bernardino",
};

const COUNTY_NAME_BY_SLUG: Record<string, string> = {
  "los-angeles": "Los Angeles County",
  orange: "Orange County",
  ventura: "Ventura County",
  "san-bernardino": "San Bernardino County",
};

function normalizeZip(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  return /^\d{5}$/.test(digits) ? digits : null;
}

function parseCsv(raw: string) {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const header = lines.shift()!.split(",").map((h) => h.trim());
  return lines.map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    header.forEach((h, idx) => {
      row[h] = cols[idx] || "";
    });
    return row as ZipRow;
  });
}

function countySlugFromRow(row: ZipRow) {
  const direct = String(row.countySlug || "").trim().toLowerCase();
  if (direct) return direct;
  const name = String(row.county || "")
    .replace(/\s+county$/i, "")
    .trim()
    .toLowerCase();
  return COUNTY_SLUG_BY_NAME[name] || null;
}

function toNum(value: string | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function importZipRows(
  db: FirebaseFirestore.Firestore,
  rows: ZipRow[]
): Promise<{
  zipsUpserted: number;
  zipPlacesUpserted: number;
  duplicatesSkipped: number;
  skippedInvalid: number;
}> {
  if (!rows.length) {
    return { zipsUpserted: 0, zipPlacesUpserted: 0, duplicatesSkipped: 0, skippedInvalid: 0 };
  }

  const now = Timestamp.now();
  const zipAgg = new Map<
    string,
    {
      zip: string;
      countySlug: string;
      countyName: string | null;
      state: string;
      placeMap: Map<string, { name: string; lat: number | null; lng: number | null }>;
      sumLat: number;
      sumLng: number;
      coordCount: number;
    }
  >();

  let skippedInvalid = 0;
  let duplicatesSkipped = 0;

  for (const row of rows) {
    const zip = normalizeZip(row.zip);
    const placeName = String(row.place || "").trim();
    const state = String(row.state || "CA").trim().toUpperCase();
    const countySlug = countySlugFromRow(row);
    if (!zip || !placeName || !countySlug || !state) {
      skippedInvalid += 1;
      continue;
    }

    const countyName = COUNTY_NAME_BY_SLUG[countySlug] || row.county || null;
    const key = `${state}-${countySlug}-${zip}`;
    const entry =
      zipAgg.get(key) || {
        zip,
        countySlug,
        countyName,
        state,
        placeMap: new Map(),
        sumLat: 0,
        sumLng: 0,
        coordCount: 0,
      };

    const placeSlug = slugify(placeName);
    if (entry.placeMap.has(placeSlug)) {
      duplicatesSkipped += 1;
      continue;
    }

    const lat = toNum(row.lat);
    const lng = toNum(row.lng);
    if (lat != null && lng != null) {
      entry.sumLat += lat;
      entry.sumLng += lng;
      entry.coordCount += 1;
    }

    entry.placeMap.set(placeSlug, { name: placeName, lat, lng });
    zipAgg.set(key, entry);
  }

  const zipWrites: Array<{ ref: FirebaseFirestore.DocumentReference; data: any }> = [];
  const placeWrites: Array<{ ref: FirebaseFirestore.DocumentReference; data: any }> = [];

  for (const entry of zipAgg.values()) {
    const zipId = `ca-${entry.countySlug}-${entry.zip}`;
    const placeNames = Array.from(entry.placeMap.values()).map((p) => p.name);
    const primaryPlaceName = placeNames[0] || "";
    const centroid =
      entry.coordCount > 0
        ? { lat: entry.sumLat / entry.coordCount, lng: entry.sumLng / entry.coordCount }
        : null;

    zipWrites.push({
      ref: db.collection("geo_zips").doc(zipId),
      data: {
        state: entry.state,
        countySlug: entry.countySlug,
        countyName: entry.countyName,
        zip: entry.zip,
        primaryPlaceName,
        placeNames,
        centroid,
        updatedAt: now,
      },
    });

    entry.placeMap.forEach((p, placeSlug) => {
      const placeId = `ca-${entry.countySlug}-${entry.zip}-${placeSlug}`;
      const placeNameLower = p.name.toLowerCase();
      const placeCentroid = p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : centroid;
      placeWrites.push({
        ref: db.collection("geo_zip_places").doc(placeId),
        data: {
          state: entry.state,
          countySlug: entry.countySlug,
          countyName: entry.countyName,
          zip: entry.zip,
          placeName: p.name,
          placeNameLower,
          placeSlug,
          slug: placeSlug,
          displayName: `${p.name} (${entry.zip})`,
          isPrimary: p.name === primaryPlaceName,
          centroid: placeCentroid,
          searchTokens: Array.from(
            new Set(
              `${p.name} ${entry.zip} ${entry.countySlug}`
                .toLowerCase()
                .split(/\s+/)
                .filter(Boolean)
            )
          ),
          updatedAt: now,
          createdAt: now,
        },
      });
    });
  }

  const chunkSize = 400;
  for (let i = 0; i < zipWrites.length; i += chunkSize) {
    const batch = db.batch();
    zipWrites.slice(i, i + chunkSize).forEach((w) => batch.set(w.ref, w.data, { merge: true }));
    await batch.commit();
  }
  for (let i = 0; i < placeWrites.length; i += chunkSize) {
    const batch = db.batch();
    placeWrites.slice(i, i + chunkSize).forEach((w) => batch.set(w.ref, w.data, { merge: true }));
    await batch.commit();
  }

  return {
    zipsUpserted: zipWrites.length,
    zipPlacesUpserted: placeWrites.length,
    duplicatesSkipped,
    skippedInvalid,
  };
}

export async function importZipCsv(
  db: FirebaseFirestore.Firestore,
  filePath: string
): Promise<{
  zipsUpserted: number;
  zipPlacesUpserted: number;
  duplicatesSkipped: number;
  skippedInvalid: number;
}> {
  const { promises: fs } = await import("fs");
  const raw = await fs.readFile(filePath, "utf8");
  const rows = parseCsv(raw);
  return importZipRows(db, rows);
}
