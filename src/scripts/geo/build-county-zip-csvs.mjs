import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

const ROOT = process.cwd();
const IN_PATH = path.join(ROOT, "data", "geo", "uszips.csv");
const OUT_DIR = path.join(ROOT, "data", "geo", "zips");

const COUNTY_ALLOWLIST = [
  { county_name: "Los Angeles", out: "la_county_zips.csv" },
  { county_name: "Orange", out: "orange_county_zips.csv" },
  { county_name: "Ventura", out: "ventura_county_zips.csv" },
  { county_name: "San Bernardino", out: "san_bernardino_county_zips.csv" },
];

const force = process.argv.includes("--force");
console.log(force ? "FORCE mode: overwriting existing CSVs" : "SAFE mode: will not overwrite existing CSVs");

function zfill5(x) {
  const s = String(x ?? "").trim();
  if (!s) return "";
  return s.padStart(5, "0");
}

function norm(s) {
  return String(s ?? "").trim();
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const raw = fs.readFileSync(IN_PATH, "utf8");
const records = parse(raw, { columns: true, skip_empty_lines: true });

const first = records[0] || {};
const cols = Object.keys(first);
console.log("uszips.csv columns:", cols);

const get = (r, keys) => {
  for (const k of keys) {
    if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== "") return r[k];
  }
  return "";
};

const hasUsZipsSchema = ["county_name", "state_id", "city"].every((c) => cols.includes(c));
const zipCol = "zip";
const placeCol = hasUsZipsSchema ? "city" : "place";
const stateCol = hasUsZipsSchema ? "state_id" : "state";
const countyCol = hasUsZipsSchema ? "county_name" : "county";

const stateVal = (r) => String(get(r, [stateCol, "state_id", "state", "stateAbbr"])).trim();
const countyVal = (r) => String(get(r, [countyCol, "county_name", "county", "countyName"])).trim();
const cityVal = (r) => String(get(r, [placeCol, "city", "place", "primary_city"])).trim();
const zipVal = (r) => String(get(r, [zipCol, "zipcode", "postal_code"])).trim();

const normCounty = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/county\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const normState = (s) => String(s || "").trim().toUpperCase();

const sampleCounties = new Map();
const rawCountyCounts = new Map();
for (const r of records) {
  if (normState(stateVal(r)) !== "CA") continue;
  const c = normCounty(countyVal(r));
  const raw = countyVal(r);
  sampleCounties.set(c, (sampleCounties.get(c) || 0) + 1);
  if (raw) rawCountyCounts.set(raw, (rawCountyCounts.get(raw) || 0) + 1);
}
console.log("Top CA counties:", [...sampleCounties.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30));
console.log("CA county samples:", [...sampleCounties.keys()].slice(0, 50));

function containsCounty(term) {
  const q = term.toLowerCase();
  return [...rawCountyCounts.entries()]
    .filter(([name]) => name.toLowerCase().includes(q))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);
}

console.log("countiesContainingOrange:", containsCounty("orange"));
console.log("countiesContainingVentura:", containsCounty("ventura"));
console.log("countiesContainingBernardino:", containsCounty("bernardino"));

const countyAllow = new Map([
  ["los angeles", "la_county_zips.csv"],
  ["orange", "orange_county_zips.csv"],
  ["ventura", "ventura_county_zips.csv"],
  ["san bernardino", "san_bernardino_county_zips.csv"],
]);

function matchesCounty(normName, countyKey) {
  return normName === countyKey || normName.includes(countyKey);
}

for (const [countyKey, outFile] of countyAllow.entries()) {
  const seen = new Set();
  const rows = records
    .filter((r) => normState(stateVal(r)) === "CA" && matchesCounty(normCounty(countyVal(r)), countyKey))
    .map((r) => ({
      zip: zfill5(zipVal(r)),
      place: cityVal(r),
      county: countyVal(r),
      state: stateVal(r),
      lat: get(r, ["lat", "latitude"]) ? Number(get(r, ["lat", "latitude"])) : "",
      lng: get(r, ["lng", "lon", "longitude"]) ? Number(get(r, ["lng", "lon", "longitude"])) : "",
    }))
    .filter((r) => /^\d{5}$/.test(r.zip) && r.place)
    .filter((r) => {
      const key = `${r.zip}__${r.place.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.zip.localeCompare(b.zip) || a.place.localeCompare(b.place));

  console.log(`Matched ${rows.length} rows for county=${countyKey}`);

  const outCsv = stringify(rows, {
    header: true,
    columns: ["zip", "place", "county", "state", "lat", "lng"],
  });

  const outPath = path.join(OUT_DIR, outFile);
  if (fs.existsSync(outPath) && !force) {
    console.log(`Skip existing (use --force to overwrite): ${outPath}`);
    continue;
  }
  fs.writeFileSync(outPath, outCsv, "utf8");
  console.log(`Wrote ${rows.length} rows -> ${outPath}`);
}
