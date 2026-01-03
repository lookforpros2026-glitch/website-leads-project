import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

function normalizeQuery(q: string) {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ items: [], error: auth.error }, { status: auth.status });
    }

    const url = new URL(req.url);
    const qRaw = url.searchParams.get("q") || "";
    const q = normalizeQuery(qRaw);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));

    if (q.length < 2) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const firstToken = q.split(" ")[0];
    const snap = await adminDb
      .collection("geo_cities")
      .where("state", "==", "CA")
      .orderBy("search", "asc")
      .orderBy("__name__", "asc")
      .startAt(firstToken)
      .endAt(firstToken + "\uf8ff")
      .limit(limit)
      .get();

    let items = snap.docs.map((d) => {
      const x = d.data() as any;
      return {
        cityKey: x.cityKey || d.id,
        cityName: x.cityName || x.name,
        citySlug: x.citySlug || x.slug,
        countyName: x.countyName,
        countySlug: x.countySlug,
        search: x.search || "",
      };
    });

    if (q.length > firstToken.length) {
      items = items.filter((c) => c.search.toLowerCase().includes(q));
    }

    return NextResponse.json({ items }, { status: 200 });
  } catch (err: any) {
    console.error("City search failed", err);
    const msg = typeof err?.message === "string" ? err.message : "SEARCH_FAILED";
    return NextResponse.json({ items: [], error: msg }, { status: 200 });
  }
}
