import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { parse } from "csv-parse/sync";
import { requireAdmin } from "@/lib/admin/authz";

export const runtime = "nodejs";

function normState(value: string) {
  return String(value || "").trim().toUpperCase();
}

function normCounty(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/county\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getColumn(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const val = row[key];
    if (val != null && String(val).trim() !== "") return String(val);
  }
  return "";
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(req.url);
  const state = (url.searchParams.get("state") || "CA").trim().toUpperCase();
  const filePath = path.join(process.cwd(), "data", "geo", "uszips.csv");

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const records = parse(raw, { columns: true, skip_empty_lines: true });
    const first = records[0] || {};
    const cols = Object.keys(first);

    const hasUsZipsSchema = ["county_name", "state_id", "city"].every((c) => cols.includes(c));
    const stateCol = hasUsZipsSchema ? "state_id" : "state";
    const countyCol = hasUsZipsSchema ? "county_name" : "county";

    const topCounts = new Map<string, number>();
    const rawCounts = new Map<string, number>();

    for (const row of records) {
      if (normState(getColumn(row, [stateCol, "state_id", "state"])) !== state) continue;
      const rawCounty = getColumn(row, [countyCol, "county_name", "county"]);
      const key = normCounty(rawCounty);
      if (!key) continue;
      topCounts.set(key, (topCounts.get(key) || 0) + 1);
      if (rawCounty) rawCounts.set(rawCounty, (rawCounts.get(rawCounty) || 0) + 1);
    }

    const topCounties = [...topCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);

    const contains = (term: string) =>
      [...rawCounts.entries()]
        .filter(([name]) => name.toLowerCase().includes(term))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25);

    return NextResponse.json(
      {
        ok: true,
        filePath,
        state,
        topCounties,
        containsOrange: contains("orange"),
        containsVentura: contains("ventura"),
        containsBernardino: contains("bernardino"),
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "READ_FAILED", filePath }, { status: 500 });
  }
}
