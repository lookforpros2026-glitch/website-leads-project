import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const countySlug = (url.searchParams.get("countySlug") || "").trim().toLowerCase();
  const limit = Math.min(200, Math.max(10, Number(url.searchParams.get("limit") || "50")));

  if (q.length < 2) {
    return NextResponse.json({ ok: true, items: [], count: 0 }, { status: 200 });
  }

  const db = getAdminDb();
  const isZipQuery = /^\d{1,5}$/.test(q);

  try {
    let snap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;
    if (isZipQuery) {
      const start = q;
      const end = `${q}\uf8ff`;
      let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection("geo_zips");
      if (countySlug) {
        query = query.where("countySlug", "==", countySlug);
      }
      snap = await query.orderBy("zip").where("zip", ">=", start).where("zip", "<=", end).limit(limit).get();
    } else {
      const start = q;
      const end = `${q}\uf8ff`;
      let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection("geo_zip_places");
      if (countySlug) {
        query = query.where("countySlug", "==", countySlug);
      }
      snap = await query.orderBy("placeNameLower").where("placeNameLower", ">=", start).where("placeNameLower", "<=", end).limit(limit).get();
    }

    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    return NextResponse.json({ ok: true, items, count: items.length }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: true, items: [], count: 0, error: "SEARCH_FAILED", detail: err?.message || String(err) }, { status: 200 });
  }
}
