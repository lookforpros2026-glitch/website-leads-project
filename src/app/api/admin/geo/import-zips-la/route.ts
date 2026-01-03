import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";
import { importZipCsv } from "@/lib/geo/zip-import";

export const runtime = "nodejs";

const DATA_FILE = path.join(process.cwd(), "data", "geo", "zips", "la_county_zips.csv");

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const db = getAdminDb();
    const cfgRef = db.collection("config").doc("geo");
    const cfgSnap = await cfgRef.get();
    const locked = cfgSnap.exists ? (cfgSnap.data() as any).locked !== false : true;
    if (locked) {
      return NextResponse.json({ ok: false, error: "GEO_LOCKED" }, { status: 423 });
    }

    try {
      await fs.access(DATA_FILE);
    } catch {
      return NextResponse.json({ ok: false, error: "MISSING_ZIP_FILE", expectedPath: DATA_FILE }, { status: 400 });
    }

    const result = await importZipCsv(db, DATA_FILE);

    const relock = new URL(req.url).searchParams.get("relock") === "1";
    if (relock) {
      const now = Timestamp.now();
      await cfgRef.set({ locked: true, lockedAt: now, lockedBy: auth.email || auth.uid || "admin" }, { merge: true });
    }

    return NextResponse.json(
      {
        ok: true,
        ...result,
        file: DATA_FILE,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "IMPORT_ZIPS_FAILED", stack: err?.stack || null }, { status: 500 });
  }
}
