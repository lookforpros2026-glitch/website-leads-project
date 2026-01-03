import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
  }
  const db = getAdminDb();
  const [countyAgg, cityAgg, neighborhoodAgg, osmAgg, tractAgg, configSnap] = await Promise.all([
    db.collection("geo_counties").count().get(),
    db.collection("geo_cities").count().get(),
    db.collection("geo_neighborhoods").count().get(),
    db.collection("geo_neighborhoods").where("source", "==", "osm").count().get(),
    db.collection("geo_neighborhoods").where("source", "==", "tract").count().get(),
    db.collection("config").doc("geo").get(),
  ]);
  const cfg = configSnap.exists ? (configSnap.data() as any) : {};
  const locked = cfg.locked !== false;
  return NextResponse.json({
    ok: true,
    countyCount: countyAgg.data().count,
    cityCount: cityAgg.data().count,
    neighborhoodCountTotal: neighborhoodAgg.data().count,
    neighborhoodCountBySource: {
      osm: osmAgg.data().count,
      tracts: tractAgg.data().count,
    },
    allowImport: process.env.ALLOW_GEO_IMPORT === "true",
    locked,
  });
}
