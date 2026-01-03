import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";
import { slugify } from "@/lib/slug";

const DATA_DIR = path.join(process.cwd(), "data", "geo");
const PLACE_FILE = path.join(DATA_DIR, "2023_Gaz_place_national.txt");
const COUNTY_FILE = path.join(DATA_DIR, "2023_Gaz_counties_national.txt");
const CROSSWALK_FILE = path.join(DATA_DIR, "st06_ca_places.txt");

const ALLOWED_COUNTY_SLUGS = new Set(["los-angeles", "orange", "ventura", "san-bernardino"]);

function parseTsv(file: string) {
  return file
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("\t"));
}

function cleanCountyName(name: string) {
  return name.replace(/ County.*/i, "").trim();
}

function cleanCityName(name: string) {
  return name
    .replace(/\s+(city|town|cdp|municipality|village)\b.*$/i, "")
    .replace(/\s+\(balance\)$/i, "")
    .trim();
}

async function chunkedCommit(db: FirebaseFirestore.Firestore, writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: any }>) {
  const chunkSize = 400;
  for (let i = 0; i < writes.length; i += chunkSize) {
    const batch = db.batch();
    writes.slice(i, i + chunkSize).forEach((w) => batch.set(w.ref, w.data, { merge: true }));
    await batch.commit();
  }
}

function buildSearchTokens(cityName: string, citySlug: string, countyName: string | null, countySlug: string | null) {
  const tokens = new Set<string>();
  cityName
    .toLowerCase()
    .split(/\s+/)
    .forEach((t) => tokens.add(t));
  tokens.add(citySlug);
  if (countyName) tokens.add(countyName.toLowerCase());
  if (countySlug) tokens.add(countySlug);
  return Array.from(tokens);
}

export async function POST() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const db = getAdminDb();
    const cfgSnap = await db.collection("config").doc("geo").get();
    const locked = cfgSnap.exists ? (cfgSnap.data() as any).locked !== false : true;
    if (locked) {
      return NextResponse.json({ ok: false, error: "GEO_LOCKED" }, { status: 423 });
    }

    try {
      await fs.access(PLACE_FILE);
      await fs.access(COUNTY_FILE);
      await fs.access(CROSSWALK_FILE);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_GAZETTEER_FILES",
          expectedPaths: [PLACE_FILE, COUNTY_FILE, CROSSWALK_FILE],
        },
        { status: 500 }
      );
    }

    const [placeRaw, countyRaw, crosswalkRaw] = await Promise.all([
      fs.readFile(PLACE_FILE, "utf8"),
      fs.readFile(COUNTY_FILE, "utf8"),
      fs.readFile(CROSSWALK_FILE, "utf8"),
    ]);

    const crosswalk = new Map<string, string>();
    crosswalkRaw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line) => {
        const parts = line.split("|");
        if (parts.length >= 7 && parts[1] === "06") {
          const geoid = `${parts[1]}${parts[2]}`;
          const countyName = parts[6]?.trim();
          if (countyName) crosswalk.set(geoid, countyName);
        }
      });

    const countyRows = parseTsv(countyRaw);
    const countyHeader = countyRows.shift();
    if (!countyHeader || countyHeader[0] !== "USPS") {
      return NextResponse.json({ ok: false, error: "COUNTY_PARSE_FAILED" }, { status: 500 });
    }
    const counties = countyRows
      .filter((r) => r[0] === "CA")
      .map((r) => {
        const rawName = r[3];
        const countyName = `${cleanCountyName(rawName)} County`;
        const countySlug = slugify(cleanCountyName(rawName));
        if (!ALLOWED_COUNTY_SLUGS.has(countySlug)) return null;
        return {
          county: countyName,
          countyId: countySlug,
          countySlug,
          state: "CA",
          stateId: "CA",
          stateCode: "CA",
          search: cleanCountyName(rawName).toLowerCase(),
          name: countyName,
        };
      });
    const allowedCounties = counties.filter(Boolean) as Array<{
      county: string;
      countyId: string;
      countySlug: string;
      state: string;
      stateId: string;
      stateCode: string;
      search: string;
      name: string;
    }>;

    const placeRows = parseTsv(placeRaw);
    const placeHeader = placeRows.shift();
    if (!placeHeader || placeHeader[0] !== "USPS") {
      return NextResponse.json({ ok: false, error: "PLACE_PARSE_FAILED" }, { status: 500 });
    }
    const places = placeRows.filter((r) => r[0] === "CA");

    const countyWrites = allowedCounties.map((c) => ({
      ref: db.collection("geo_counties").doc(`ca-${c.countySlug}`),
      data: {
        state: c.state,
        stateCode: c.stateCode,
        county: c.county,
        countyId: c.countyId,
        countySlug: c.countySlug,
        search: c.search,
      },
    }));

    const cityWrites: Array<{ ref: FirebaseFirestore.DocumentReference; data: any }> = [];
    for (const row of places) {
      const geoid = row[1];
      const name = row[3];
      const cityName = cleanCityName(name);
      const citySlug = slugify(cityName);
      const countyNameRaw = geoid ? crosswalk.get(geoid) ?? null : null;
      const countyName = countyNameRaw ? `${cleanCountyName(countyNameRaw)} County` : null;
      const countySlug = countyNameRaw ? slugify(cleanCountyName(countyNameRaw)) : null;
      if (!countySlug || !ALLOWED_COUNTY_SLUGS.has(countySlug)) continue;
      const countyId = countySlug ? `ca-${countySlug}` : null;
      const docId = countySlug ? `ca-${countySlug}-${citySlug}` : `ca-${citySlug}`;
      const search = `${cityName} ${countyName || ""} CA`.trim().toLowerCase();
      cityWrites.push({
        ref: db.collection("geo_cities").doc(docId),
        data: {
          name: cityName,
          slug: citySlug,
          state: "CA",
          stateId: "CA",
          stateCode: "CA",
          county: countyName,
          countyName,
          countyId,
          countySlug,
          city: cityName,
          cityName,
          cityId: citySlug,
          citySlug,
          cityKey: docId,
          search,
          searchTokens: buildSearchTokens(cityName, citySlug, countyName, countySlug),
        },
      });
    }

    await chunkedCommit(db, [...countyWrites, ...cityWrites]);

    await db
      .collection("config")
      .doc("geo")
      .set({ locked: true, lockedAt: Timestamp.now(), lockedBy: auth.email || auth.uid || "admin" }, { merge: true });

    return NextResponse.json({ ok: true, counties: allowedCounties.length, cities: cityWrites.length }, { status: 200 });
  } catch (err: any) {
    console.error("Import California failed", err);
    return NextResponse.json({ ok: false, error: "IMPORT_FAILED", detail: err?.message }, { status: 500 });
  }
}

