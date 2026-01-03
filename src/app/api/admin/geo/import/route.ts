import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";
import { slugify } from "@/lib/slug";

type GeoFile = {
  state: { id: string; name: string; abbr: string; fips?: string };
  counties: Array<{
    countyId: string;
    countyName: string;
    fips?: string;
    cities: Array<{ cityId: string; cityName: string; slug: string }>;
  }>;
};

function buildCityDoc(parsedState: GeoFile["state"], county: GeoFile["counties"][number], city: { cityId: string; cityName: string; slug: string }) {
  const countySlug = slugify(county.countyName);
  const citySlug = slugify(city.slug || city.cityName);
  const search = `${city.cityName} ${county.countyName} ${parsedState.abbr}`.toLowerCase();
  const tokens = Array.from(
    new Set([
      ...city.cityName.toLowerCase().split(/\s+/),
      citySlug,
      county.countyName.toLowerCase(),
      countySlug,
      `${citySlug}-${countySlug}`,
    ])
  );
  return {
    name: city.cityName,
    slug: citySlug,
    cityName: city.cityName,
    citySlug,
    cityKey: city.cityId,
    countyName: county.countyName,
    countySlug,
    countyId: county.countyId,
    state: parsedState.abbr,
    stateId: parsedState.id,
    search,
    searchTokens: tokens,
  };
}

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
  }
  if (process.env.ALLOW_GEO_IMPORT !== "true") {
    return NextResponse.json({ ok: false, error: "geo_import_disabled" }, { status: 403 });
  }

  try {
    const db = getAdminDb();
    const configSnap = await db.collection("config").doc("geo").get();
    const locked = configSnap.exists ? (configSnap.data() as any).locked !== false : true;
    if (locked) {
      return NextResponse.json({ ok: false, error: "GEO_LOCKED" }, { status: 423 });
    }

    const filePath = path.join(process.cwd(), "data", "ca-geo.json");
    const raw = await fs.readFile(filePath, "utf8");
    const parsed: GeoFile = JSON.parse(raw);

    const batch = db.batch();

    const stateRef = db.collection("geo_states").doc(parsed.state.id);
    batch.set(stateRef, { name: parsed.state.name, abbr: parsed.state.abbr, fips: parsed.state.fips || null }, { merge: true });

    let countyCount = 0;
    let cityCount = 0;

    for (const county of parsed.counties) {
      const countySlug = slugify(county.countyName);
      const countyId = `ca-${countySlug}`;
      const countyRef = db.collection("geo_counties").doc(countyId);
      batch.set(
        countyRef,
        {
          name: county.countyName,
          countyName: county.countyName,
          countySlug,
          state: parsed.state.abbr,
          stateId: parsed.state.id,
          fips: county.fips || null,
        },
        { merge: true }
      );
      countyCount += 1;

      for (const city of county.cities) {
        const doc = buildCityDoc(parsed.state, { ...county, countyId }, city);
        const cityRef = db.collection("geo_cities").doc(doc.cityKey);
        batch.set(cityRef, doc, { merge: true });
        cityCount += 1;
      }
    }

    await batch.commit();

    return NextResponse.json({ ok: true, stateId: parsed.state.id, counties: countyCount, cities: cityCount }, { status: 200 });
  } catch (err: any) {
    console.error("Geo import failed", err);
    return NextResponse.json({ ok: false, error: "import_failed", detail: err?.message ?? String(err) }, { status: 500 });
  }
}

