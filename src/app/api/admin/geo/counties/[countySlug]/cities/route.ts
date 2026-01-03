import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

export async function GET(req: Request, ctx: { params: Promise<{ countySlug: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const { countySlug } = await ctx.params;
    const url = new URL(req.url);
    const limit = Math.min(5000, Math.max(1, parseInt(url.searchParams.get("limit") || "5000", 10)));
    const db = getAdminDb();
    const snap = await db
      .collection("geo_cities")
      .where("state", "==", "CA")
      .where("countySlug", "==", countySlug)
      .orderBy("search", "asc")
      .orderBy("__name__", "asc")
      .limit(limit)
      .get();
    const cities = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    return NextResponse.json({ ok: true, cities }, { status: 200 });
  } catch (err: any) {
    console.error("County cities fetch failed", err);
    return NextResponse.json({ ok: false, error: err?.message || "FETCH_FAILED" }, { status: 500 });
  }
}
