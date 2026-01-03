import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb, getAdminStorageBucket } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";
import { importZipRows } from "@/lib/geo/zip-import";

export const runtime = "nodejs";

type ZipRow = {
  zip: string;
  place: string;
  county: string;
  state: string;
  lat?: string;
  lng?: string;
  countySlug?: string;
};

function toText(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("utf8");
}

function getFirstNonEmpty(record: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const v = record[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function normalizeZip(value: string) {
  const digits = value.replace(/\D/g, "");
  return /^\d{5}$/.test(digits) ? digits : "";
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const url = new URL(req.url);
    const countySlug = (url.searchParams.get("countySlug") || "").trim().toLowerCase();
    if (!countySlug) {
      return NextResponse.json({ ok: false, error: "MISSING_COUNTY" }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ ok: false, error: "MISSING_FILE" }, { status: 400 });
    }

    const buf = await (file as File).arrayBuffer();
    const raw = toText(buf);
    const records = parse(raw, { columns: true, skip_empty_lines: true });
    const first = records[0] || {};
    const cols = Object.keys(first);

    const hasUsZipsSchema = ["county_name", "state_id", "city"].every((c) => cols.includes(c));
    const zipKey = "zip";
    const placeKey = hasUsZipsSchema ? "city" : "place";
    const stateKey = hasUsZipsSchema ? "state_id" : "state";
    const countyKey = hasUsZipsSchema ? "county_name" : "county";

    const rows: ZipRow[] = records
      .map((r: Record<string, any>) => {
        const zip = normalizeZip(getFirstNonEmpty(r, [zipKey, "zipcode", "postal_code"]));
        const place = getFirstNonEmpty(r, [placeKey, "city", "place", "primary_city"]);
        const county = getFirstNonEmpty(r, [countyKey, "county_name", "county"]);
        const state = getFirstNonEmpty(r, [stateKey, "state_id", "state"]);
        const lat = getFirstNonEmpty(r, ["lat", "latitude"]);
        const lng = getFirstNonEmpty(r, ["lng", "lon", "longitude"]);
        return {
          zip,
          place,
          county,
          state,
          lat,
          lng,
          countySlug,
        };
      })
      .filter((r: ZipRow) => r.zip && r.place && r.state);

    const db = getAdminDb();
    const result = await importZipRows(db, rows);

    const bucket = getAdminStorageBucket();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const objectPath = `geo/zips/${countySlug}/${stamp}.csv`;
    await bucket.file(objectPath).save(raw, { contentType: "text/csv" });

    await db.collection("geo_uploads").add({
      countySlug,
      objectPath,
      originalFileName: (file as File).name || null,
      columns: cols,
      importedAt: Timestamp.now(),
      ...result,
    });

    return NextResponse.json(
      {
        ok: true,
        items: [],
        count: 0,
        ...result,
        objectPath,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "UPLOAD_FAILED", stack: err?.stack || null }, { status: 500 });
  }
}
