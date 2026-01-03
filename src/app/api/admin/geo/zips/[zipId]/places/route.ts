import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

function parseZipId(zipId: string) {
  const match = /^ca-([a-z-]+)-(\d{5})$/.exec(zipId);
  if (!match) return null;
  return { countySlug: match[1], zip: match[2] };
}

export async function GET(req: Request, ctx: { params: Promise<{ zipId: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ ok: true, items: [], count: 0, error: auth.error }, { status: auth.status });
    }

    const { zipId } = await ctx.params;
    const parsed = parseZipId(zipId);
    if (!parsed) {
      return NextResponse.json({ ok: true, items: [], count: 0, error: "INVALID_ZIP_ID" }, { status: 200 });
    }

    const db = getAdminDb();
    const snap = await db
      .collection("geo_zip_places")
      .where("zip", "==", parsed.zip)
      .where("countySlug", "==", parsed.countySlug)
      .orderBy("placeName")
      .get();

    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    return NextResponse.json({ ok: true, items, count: items.length }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: true, items: [], count: 0, error: "FETCH_FAILED", detail: err?.message || String(err) }, { status: 200 });
  }
}
