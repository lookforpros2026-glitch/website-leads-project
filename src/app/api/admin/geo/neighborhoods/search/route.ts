import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  try {
    const db = getAdminDb();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").toLowerCase().trim();
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 50)));

    if (q.length < 2) return NextResponse.json({ ok: true, items: [] });

    const snap = await db
      .collection("geo_neighborhoods")
      .where("state", "==", "CA")
      .where("search", "array-contains", q)
      .orderBy("neighborhoodName", "asc")
      .limit(limit)
      .get();

    const items = snap.docs.map((d) => {
      const x = d.data() as any;
      return {
        id: d.id,
        neighborhoodName: x.neighborhoodName,
        neighborhoodSlug: x.neighborhoodSlug,
        citySlug: x.citySlug,
        cityName: x.cityName,
        countySlug: x.countySlug || null,
        countyName: x.countyName || null,
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (err: any) {
    // Always JSON so your UI doesn't crash on res.json()
    console.error("Neighborhood search failed", err);
    return NextResponse.json({ ok: false, error: err?.message || "search_failed" }, { status: 500 });
  }
}
