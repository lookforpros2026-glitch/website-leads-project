import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

export async function GET(req: Request, ctx: { params: Promise<{ citySlug: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    // Despite the param name, we treat this value as the geo_cities document id (GeneratorClient passes city.id/cityKey).
    const { citySlug: cityId } = await ctx.params;
    const url = new URL(req.url);
    const limit = Math.min(5000, Math.max(10, Number(url.searchParams.get("limit") || "2000")));
    const prefer = (url.searchParams.get("prefer") || "osm").toLowerCase(); // osm | tract | all
    const includeSource = true;

    const db = getAdminDb();
    const snap = await db
      .collection("geo_neighborhoods")
      .where("cityId", "==", cityId)
      .orderBy("name")
      .limit(limit)
      .get();

    const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    const isOsm = (n: any) => {
      const s = String(n?.source || "").toLowerCase();
      return s === "osm" || s === "osm_place" || s === "osm-neighborhoods";
    };
    const isTract = (n: any) => {
      const s = String(n?.source || "").toLowerCase();
      return s === "tract" || s === "gazetteer_tracts_2023";
    };

    let neighborhoods = all;
    if (prefer === "osm") {
      const osm = all.filter(isOsm);
      neighborhoods = osm.length ? osm : all.filter(isTract);
    } else if (prefer === "tract") {
      neighborhoods = all.filter(isTract);
    }

    neighborhoods = neighborhoods.map((n: any) => {
      const name = n.name || n.neighborhoodName || "";
      const neighborhoodSlug = n.neighborhoodSlug || n.slug || "";
      const centroid =
        n.centroid && typeof n.centroid.lat === "number" && (typeof n.centroid.lng === "number" || typeof n.centroid.lon === "number")
          ? { lat: n.centroid.lat, lng: n.centroid.lng ?? n.centroid.lon }
          : typeof n.lat === "number" && typeof n.lon === "number"
            ? { lat: n.lat, lng: n.lon }
            : null;

      const out: any = {
        id: n.id,
        name,
        slug: neighborhoodSlug,
        neighborhoodSlug,
        cityId: n.cityId,
        citySlug: n.citySlug,
        cityName: n.cityName,
        countySlug: n.countySlug,
        countyName: n.countyName,
        centroid,
        lat: typeof n.lat === "number" ? n.lat : centroid?.lat ?? null,
        lon: typeof n.lon === "number" ? n.lon : centroid?.lng ?? null,
        placeType: n.osm?.place || n.placeType || null,
        source: n.source || null,
      };

      if (includeSource) {
        out.sourceDetail = n.sourceDetail || null;
      }

      return out;
    });

    return NextResponse.json({ ok: true, neighborhoods }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "FETCH_FAILED", stack: err?.stack || null },
      { status: 500 }
    );
  }
}
