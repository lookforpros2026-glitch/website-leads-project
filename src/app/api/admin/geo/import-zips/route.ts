import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";
import { importZipCsv } from "@/lib/geo/zip-import";

export const runtime = "nodejs";

const FILE_BY_COUNTY: Record<string, string> = {
  "los-angeles": "la_county_zips.csv",
  orange: "orange_county_zips.csv",
  ventura: "ventura_county_zips.csv",
  "san-bernardino": "san_bernardino_county_zips.csv",
};

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const db = getAdminDb();
    const cfgRef = db.collection("config").doc("geo");
    const cfgSnap = await cfgRef.get();
    const url = new URL(req.url);
    const countySlug = (url.searchParams.get("countySlug") || "").toLowerCase();
    const cfg = cfgSnap.exists ? (cfgSnap.data() as any) : {};
    const locked = cfg.locked !== false;
    const allowedCountySlugs = Array.isArray(cfg.allowedCountySlugs)
      ? cfg.allowedCountySlugs.map((s: any) => String(s))
      : [];
    if (locked) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "GEO_LOCKED",
          error: "GEO_LOCKED",
          locked,
          allowedCountySlugs,
          countySlug,
          hint: "Unlock geo via POST /api/admin/geo/lock { locked:false } before importing.",
        },
        { status: 423 }
      );
    }
    const fileName = FILE_BY_COUNTY[countySlug];
    if (!fileName) {
      return NextResponse.json(
        { ok: false, errorCode: "INVALID_COUNTY", error: "INVALID_COUNTY", allowed: Object.keys(FILE_BY_COUNTY), countySlug },
        { status: 400 }
      );
    }

    const filePath = path.join(process.cwd(), "data", "geo", "zips", fileName);
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ ok: false, error: "MISSING_ZIP_FILE", expectedPath: filePath }, { status: 400 });
    }

    const result = await importZipCsv(db, filePath);
    const relock = url.searchParams.get("relock") === "1";
    if (relock) {
      const now = Timestamp.now();
      await cfgRef.set({ locked: true, lockedAt: now, lockedBy: auth.email || auth.uid || "admin" }, { merge: true });
    }

    return NextResponse.json({ ok: true, ...result, file: filePath }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "IMPORT_ZIPS_FAILED", stack: err?.stack || null }, { status: 500 });
  }
}
