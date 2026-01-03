import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

const DEFAULT_ALLOWED_COUNTY_SLUGS = ["los-angeles", "orange", "ventura", "san-bernardino"];

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
  }
  const url = new URL(req.url);
  const stateId = url.searchParams.get("stateId") || "CA";
  const db = getAdminDb();

  const cfgSnap = await db.collection("config").doc("geo").get();
  const cfg = cfgSnap.exists ? ((cfgSnap.data() as any) ?? {}) : {};
  const allowedCountySlugs = Array.isArray(cfg.allowedCountySlugs) && cfg.allowedCountySlugs.length ? cfg.allowedCountySlugs : DEFAULT_ALLOWED_COUNTY_SLUGS;
  const allow = new Set<string>(allowedCountySlugs.map((s: any) => String(s)));

  let q = db.collection("geo_counties") as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
  if (stateId) q = q.where("state", "==", stateId);
  const snap = await q.get();
  const counties = snap.docs
    .map((d) => {
      const data = d.data() as any;
      const countySlug = data.countySlug || data.slug || d.id.replace(/^ca-/, "");
      return {
        id: d.id,
        name: data.name || data.countyName || data.county,
        countyName: data.name || data.countyName || data.county,
        countySlug,
        stateId: data.state || data.stateId || "CA",
      };
    })
    .filter((c) => allow.has(c.countySlug))
    .sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ ok: true, counties });
}
