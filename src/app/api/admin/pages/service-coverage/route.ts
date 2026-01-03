import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const countySlug = (searchParams.get("countySlug") || "").trim();
  const zipsRaw = (searchParams.get("zips") || "").trim();
  if (!countySlug || !zipsRaw) {
    return NextResponse.json({ ok: true, byZip: {} }, { status: 200 });
  }

  const zips = zipsRaw
    .split(",")
    .map((z) => z.trim())
    .filter((z) => /^\d{5}$/.test(z));

  if (!zips.length) {
    return NextResponse.json({ ok: true, byZip: {} }, { status: 200 });
  }

  const db = getAdminDb();
  const byZip = new Map<string, Set<string>>();

  for (const group of chunk(zips, 10)) {
    const snap = await db
      .collection("pages")
      .where("countySlug", "==", countySlug)
      .where("zip", "in", group)
      .get();

    snap.forEach((doc) => {
      const data = doc.data() as any;
      const zip = data?.zip;
      const svc = data?.service?.key || data?.service?.slug || data?.serviceKey;
      if (!zip || !svc) return;
      if (!byZip.has(zip)) byZip.set(zip, new Set());
      byZip.get(zip)!.add(String(svc));
    });
  }

  const result: Record<string, number> = {};
  for (const zip of zips) {
    result[zip] = byZip.get(zip)?.size || 0;
  }

  return NextResponse.json({ ok: true, byZip: result }, { status: 200 });
}
