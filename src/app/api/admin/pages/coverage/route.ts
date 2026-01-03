import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
  }

  const url = new URL(req.url);
  const zipIdsParam = (url.searchParams.get("zipIds") || "").trim();
  const countySlug = (url.searchParams.get("countySlug") || "").trim().toLowerCase();
  if (!zipIdsParam) {
    return NextResponse.json({ ok: true, coverage: {} }, { status: 200 });
  }

  const zipIds = Array.from(
    new Set(
      zipIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    )
  );

  const db = getAdminDb();
  const coverage: Record<string, { distinctServices: number }> = {};
  const serviceSets: Record<string, Set<string>> = {};

  for (const group of chunk(zipIds, 30)) {
    let q: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db
      .collection("pages")
      .where("place.zipPlaceId", "in", group);
    if (countySlug) q = q.where("countySlug", "==", countySlug);
    const snap = await q.get();
    snap.docs.forEach((doc) => {
      const data = doc.data() as any;
      const zipId = data?.place?.zipPlaceId;
      if (!zipId) return;
      const serviceKey = data?.service?.key || data?.serviceKey || data?.service?.slug;
      if (!serviceKey) return;
      if (!serviceSets[zipId]) serviceSets[zipId] = new Set<string>();
      serviceSets[zipId].add(serviceKey);
    });
  }

  Object.keys(serviceSets).forEach((zipId) => {
    coverage[zipId] = { distinctServices: serviceSets[zipId].size };
  });

  return NextResponse.json({ ok: true, coverage }, { status: 200 });
}
