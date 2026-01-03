import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(req.url);
  const state = url.searchParams.get("state") || "CA";
  const countySlug = url.searchParams.get("countyId") || url.searchParams.get("countySlug");
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") || "500", 10)));
  const cursor = url.searchParams.get("cursor");

  try {
    let q = getAdminDb()
      .collection("geo_cities")
      .where("state", "==", state)
      .orderBy("search", "asc")
      .orderBy("__name__", "asc")
      .limit(limit);

    if (countySlug) {
      q = getAdminDb()
        .collection("geo_cities")
        .where("state", "==", state)
        .where("countySlug", "==", countySlug)
        .orderBy("search", "asc")
        .orderBy("__name__", "asc")
        .limit(limit);
    }

    if (cursor) {
      const [searchCursor, nameCursor] = cursor.split("|");
      if (searchCursor && nameCursor) {
        const docRef = getAdminDb().collection("geo_cities").doc(nameCursor);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          q = q.startAfter(searchCursor, nameCursor);
        }
      }
    }

    const snap = await q.get();
    const cities = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    const last = snap.docs[snap.docs.length - 1];
    const nextCursor = last ? `${last.get("search") || ""}|${last.id}` : null;

    return NextResponse.json({ ok: true, cities, nextCursor }, { status: 200 });
  } catch (err: any) {
    console.error("Cities fetch failed", err);
    return NextResponse.json({ ok: false, error: "FETCH_FAILED" }, { status: 200 });
  }
}
