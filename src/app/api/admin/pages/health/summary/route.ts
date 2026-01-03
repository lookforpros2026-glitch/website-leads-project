import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";

function tsToMs(v: unknown): number | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return null;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error, status: auth.status }, { status: auth.status });
  }

  const db = getAdminDb();

  const totalSnap = await db.collection("pages").count().get();
  const scannedSnap = await db.collection("pages").where("healthStatus", "in", ["ok", "warn", "fail"]).count().get();
  const warnSnap = await db.collection("pages").where("healthStatus", "==", "warn").count().get();
  const failSnap = await db.collection("pages").where("healthStatus", "==", "fail").count().get();
  const missingSnap = await db.collection("pages").where("missingCount", ">", 0).count().get();
  const duplicateSnap = await db.collection("pages").where("duplicateCount", ">", 0).count().get();

  const lastScan = await db.collection("pages").where("healthStatus", "in", ["ok", "warn", "fail"]).orderBy("health.scannedAt", "desc").limit(1).get();
  const lastScanAt = lastScan.empty ? null : tsToMs(lastScan.docs[0].get("health.scannedAt"));

  const topMissing: Record<string, number> = {};
  const topDuplicates: Record<string, number> = {};
  const sampleSnap = await db
    .collection("pages")
    .where("healthStatus", "in", ["warn", "fail"])
    .orderBy("health.scannedAt", "desc")
    .limit(200)
    .get();

  sampleSnap.docs.forEach((doc) => {
    const health = doc.get("health") as any;
    const missing: string[] = Array.isArray(health?.missingRequired) ? health.missingRequired : [];
    const duplicates: any[] = Array.isArray(health?.duplicates) ? health.duplicates : [];
    missing.forEach((key) => {
      topMissing[key] = (topMissing[key] || 0) + 1;
    });
    duplicates.forEach((dup) => {
      const key = dup?.sectionKey;
      if (!key) return;
      topDuplicates[key] = (topDuplicates[key] || 0) + 1;
    });
  });

  const sortCounts = (obj: Record<string, number>) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => ({ key, count }));

  return NextResponse.json({
    ok: true,
    totals: {
      total: totalSnap.data().count,
      scanned: scannedSnap.data().count,
      warn: warnSnap.data().count,
      fail: failSnap.data().count,
      missing: missingSnap.data().count,
      duplicates: duplicateSnap.data().count,
    },
    topMissing: sortCounts(topMissing),
    topDuplicates: sortCounts(topDuplicates),
    lastScanAt,
  });
}
