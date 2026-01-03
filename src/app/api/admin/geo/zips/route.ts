import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ ok: true, items: [], count: 0, error: auth.error }, { status: auth.status });
    }

    const url = new URL(req.url);
    const countySlug = (url.searchParams.get("countySlug") || "").toLowerCase();
    const limit = Math.min(5000, Math.max(10, Number(url.searchParams.get("limit") || "2000")));

    const db = getAdminDb();
    let q: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection("geo_zips");
    if (countySlug) {
      q = q.where("countySlug", "==", countySlug);
    }
    const snap = await q.orderBy("zip").limit(limit).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    return NextResponse.json({ ok: true, items, count: items.length }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: true, items: [], count: 0, error: "FETCH_FAILED", detail: err?.message || String(err) }, { status: 200 });
  }
}
