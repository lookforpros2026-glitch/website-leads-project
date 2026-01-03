import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin/authz";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data", "geo", "osm");

const COUNTY_NAME_BY_SLUG: Record<string, string> = {
  "los-angeles": "Los Angeles County",
  orange: "Orange County",
  ventura: "Ventura County",
  "san-bernardino": "San Bernardino County",
};

const MAX_CITY_DISTANCE_KM_BY_COUNTY: Record<string, number> = {
  "los-angeles": 25,
  orange: 25,
  ventura: 30,
  "san-bernardino": 40,
};

const TARGET_COUNTIES: Array<{
  countySlug: string;
  countyName: string;
  countyFips: string; // 3-digit
  osmFips: string; // 5-digit state+county
}> = [
  { countySlug: "los-angeles", countyName: "Los Angeles County", countyFips: "037", osmFips: "06037" },
  { countySlug: "orange", countyName: "Orange County", countyFips: "059", osmFips: "06059" },
  { countySlug: "ventura", countyName: "Ventura County", countyFips: "111", osmFips: "06111" },
  { countySlug: "san-bernardino", countyName: "San Bernardino County", countyFips: "071", osmFips: "06071" },
];

type OSMElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = { elements: OSMElement[] };

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
] as const;

function json(ok: boolean, payload: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ok, ...payload }, { status });
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function extractOverpassHtmlError(html: string): string | null {
  const strong = html.match(/<strong[^>]*style=["'][^"']*color\s*:\s*#ff0000[^"']*["'][^>]*>([\s\S]*?)<\/strong>/i);
  if (strong?.[1]) {
    const cleaned = decodeHtmlEntities(strong[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (cleaned) return cleaned;
  }

  const pre = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (pre?.[1]) {
    const cleaned = decodeHtmlEntities(pre[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (cleaned) return cleaned.slice(0, 300);
  }

  return null;
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function elementCenter(el: OSMElement): { lat: number; lon: number } | null {
  if (el.type === "node" && typeof el.lat === "number" && typeof el.lon === "number") return { lat: el.lat, lon: el.lon };
  if (el.center && typeof el.center.lat === "number" && typeof el.center.lon === "number") return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

function neighborhoodSlugFor(name: string) {
  return slugify(name);
}

function escapeOverpassRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function placeTypeForElement(el: OSMElement): string | null {
  const boundary = el.tags?.boundary;
  const adminLevel = el.tags?.admin_level;
  if (boundary === "administrative" && adminLevel === "10") return "admin10";
  const place = el.tags?.place;
  return typeof place === "string" && place ? place : null;
}

function importanceTierFor(placeType: string) {
  return placeType === "hamlet" || placeType === "locality" ? "micro" : "standard";
}

function candidateScore(placeType: string, hasCenter: boolean, name: string) {
  const typeWeight = placeType === "admin10" ? 3 : 2;
  const centerWeight = hasCenter ? 1 : 0;
  return typeWeight * 1000000 + centerWeight * 10000 + name.length;
}

function inferCityIdFromTags(tags: Record<string, string> | undefined, countySlug: string) {
  if (!tags) return null;
  const cityRaw =
    tags["is_in:city"] ||
    tags["addr:city"] ||
    tags["is_in"] ||
    tags["is_in:municipality"] ||
    "";
  const s = String(cityRaw || "").toLowerCase();
  if (countySlug === "los-angeles" && s.includes("los angeles")) return "ca-los-angeles-los-angeles";
  return null;
}

function buildCountyQuery(countyName: string) {
  const nameRegex = `^${escapeOverpassRegex(countyName)}(,.*)?$`;
  return `
[out:json][timeout:180];
rel
  ["boundary"="administrative"]
  ["admin_level"="6"]
  ["name"~"${nameRegex}"];
map_to_area -> .a;
(
  rel["boundary"="administrative"]["admin_level"="10"](area.a);
  nwr["place"~"^(neighbourhood|suburb|quarter)$"](area.a);
);
out tags center;
`.trim();
}

async function fetchOverpassNeighborhoods(countyName: string) {
  const query = buildCountyQuery(countyName).trim();
  const body = new URLSearchParams({ data: query }).toString();
  const queryHead = query.slice(0, 120);
  const postBodyHead = body.slice(0, 120);

  let lastErr: any = null;
  let lastEmpty: any = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          accept: "application/json",
        },
        body,
      });

      const contentType = res.headers.get("content-type") || "";
      const status = res.status;

      if (!res.ok || !contentType.toLowerCase().includes("application/json")) {
        const raw = await res.text().catch(() => "");
        const overpassError = contentType.toLowerCase().includes("text/html") ? extractOverpassHtmlError(raw) : null;

        const error = !res.ok ? "OVERPASS_FAILED" : "OVERPASS_NON_JSON";
        const e: any = new Error(`${error} status=${status} contentType=${contentType}`);
        e.meta = {
          endpoint,
          status,
          contentType,
          overpassError,
          bodySnippet: raw.slice(0, 800),
          query,
          queryHead,
          postBodyHead,
        };

        lastErr = e;
        continue;
      }

      const data = (await res.json()) as OverpassResponse;
      const elementsCount = Array.isArray(data?.elements) ? data.elements.length : 0;
      if (elementsCount === 0) {
        lastEmpty = { data, query, endpoint, status, contentType, queryHead, postBodyHead };
        continue;
      }
      return { data, query, endpoint, status, contentType, queryHead, postBodyHead };
    } catch (err: any) {
      const normalized =
        typeof err?.message === "string" && err.message.startsWith("OVERPASS_")
          ? err
          : (() => {
              const e: any = new Error(`OVERPASS_FAILED network_error=${String(err?.message || err)}`);
              e.meta = {
                endpoint,
                status: null,
                contentType: null,
                overpassError: null,
                bodySnippet: null,
                query,
                queryHead,
                postBodyHead,
              };
              return e;
            })();

      lastErr = normalized;
      continue;
    }
  }

  if (lastEmpty) return lastEmpty;
  throw lastErr || new Error("OVERPASS_FAILED unknown error");
}

async function loadOrFetchCountyFile(
  countySlug: string,
  countyLabel: string,
  refresh: boolean,
  forceCacheEmpty: boolean
) {
  const filePath = path.join(DATA_DIR, `osm_neighborhoods_${countySlug}.json`);
  if (!refresh) {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as OverpassResponse;
      const elementsCount = Array.isArray(parsed?.elements) ? parsed.elements.length : 0;
      if (elementsCount === 0 && !forceCacheEmpty) {
        const e = new Error(`OSM_EMPTY cached county=${countySlug}`);
        (e as any).meta = { countySlug, filePath, cached: true, elementsCount };
        throw e;
      }
      return { filePath, data: parsed, downloaded: false };
    } catch {
      // fall through to fetch
    }
  }

  const fetched = await fetchOverpassNeighborhoods(countyLabel);
  const elementsCount = Array.isArray(fetched.data?.elements) ? fetched.data.elements.length : 0;
  if (elementsCount === 0) {
    if (!forceCacheEmpty) {
      const e = new Error(`OSM_EMPTY county=${countySlug}`);
      (e as any).meta = {
        countySlug,
        query: fetched.query,
        queryHead: fetched.queryHead,
        postBodyHead: fetched.postBodyHead,
        endpoint: fetched.endpoint,
        status: fetched.status,
        contentType: fetched.contentType,
        elementsCount,
      };
      throw e;
    }
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(fetched.data), "utf8");
  return {
    filePath,
    data: fetched.data,
    downloaded: true,
    query: fetched.query,
    queryHead: fetched.queryHead,
    postBodyHead: fetched.postBodyHead,
    endpoint: fetched.endpoint,
  };
}

async function chunkedCommit(db: FirebaseFirestore.Firestore, writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: any }>) {
  const chunkSize = 400;
  for (let i = 0; i < writes.length; i += chunkSize) {
    const batch = db.batch();
    writes.slice(i, i + chunkSize).forEach((w) => batch.set(w.ref, w.data, { merge: true }));
    await batch.commit();
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return json(false, { error: auth.error }, auth.status);
    }

    const db = getAdminDb();
    const cfgRef = db.collection("config").doc("geo");
    const cfgSnap = await cfgRef.get();
    const cfg = cfgSnap.exists ? ((cfgSnap.data() as any) ?? {}) : {};

    const locked = cfgSnap.exists ? cfg.locked !== false : true;
    if (locked) return json(false, { error: "GEO_LOCKED" }, 423);

    if (!cfg.cityCentroidsReady) {
      return json(
        false,
        {
          error: "NO_CITY_CENTROIDS",
          hint: "Run POST /api/admin/geo/backfill-city-centroids-california first (geo must be unlocked).",
        },
        400
      );
    }

    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "1";
    const forceCacheEmpty = url.searchParams.get("forceCacheEmpty") === "1";

    // Load cities for target counties and require canonical centroid field.
    const citySnap = await db.collection("geo_cities").where("state", "==", "CA").get();
    const citiesByCountySlug = new Map<string, Array<any>>();
    const missingSample: string[] = [];

    for (const d of citySnap.docs) {
      const data = d.data() as any;
      const countySlug = String(data?.countySlug || "");
      if (!TARGET_COUNTIES.some((c) => c.countySlug === countySlug)) continue;

      const centroid = data?.centroid;
      if (!(typeof centroid?.lat === "number" && typeof centroid?.lng === "number")) {
        if (missingSample.length < 10) missingSample.push(d.id);
        continue;
      }

      const list = citiesByCountySlug.get(countySlug) || [];
      list.push({ id: d.id, ...data, __centroid: { lat: centroid.lat, lon: centroid.lng } });
      citiesByCountySlug.set(countySlug, list);
    }

    const usableCityCount = Array.from(citiesByCountySlug.values()).reduce((n, arr) => n + arr.length, 0);
    if (!usableCityCount) {
      return json(
        false,
        {
          error: "CENTROIDS_FLAG_SET_BUT_NO_CITY_COORDS",
          missingSample,
          hint: "Backfill must write geo_cities/{id}.centroid = {lat,lng}. Re-run backfill, then re-run import.",
        },
        500
      );
    }

    let imported = 0;
    let unmatched = 0;
    let skippedNoName = 0;
    let inserted = 0;
    let updated = 0;
    const sampleNames: string[] = [];
    const fileResults: Record<
      string,
      { filePath: string; downloaded: boolean; totalElements: number; debug?: { queryHead: string; postBodyHead: string } }
    > = {};

    const bestByCitySlug = new Map<string, Map<string, { data: any; score: number; name: string }>>();
    const nowMs = Date.now();

    for (const county of TARGET_COUNTIES) {
      let loaded: any;
      const countyName = COUNTY_NAME_BY_SLUG[county.countySlug];
      if (!countyName) {
        return json(false, { error: "INVALID_COUNTY", county: county.countySlug }, 400);
      }
      try {
        loaded = await loadOrFetchCountyFile(county.countySlug, countyName, refresh, forceCacheEmpty);
      } catch (err: any) {
        const msg = String(err?.message || "");
        const meta = err?.meta || null;
        if (msg.startsWith("OVERPASS_FAILED") || msg.startsWith("OVERPASS_NON_JSON")) {
          return json(
            false,
            {
              error: msg.startsWith("OVERPASS_NON_JSON") ? "OVERPASS_NON_JSON" : "OVERPASS_FAILED",
              county: county.countySlug,
              status: meta?.status ?? null,
              contentType: meta?.contentType ?? null,
              endpoint: meta?.endpoint ?? null,
              overpassError: meta?.overpassError ?? null,
              overpassBodySnippet: meta?.bodySnippet ?? null,
              debug: {
                queryHead: meta?.queryHead ?? null,
                postBodyHead: meta?.postBodyHead ?? null,
              },
              detail: msg,
              hint: "Query invalid or Overpass error. Use POST + URL-encoded body, verify query syntax, and retry with ?refresh=1.",
            },
            502
          );
        }

        return json(
          false,
          {
            error: "OSM_EMPTY",
            hint: `No neighborhood candidates found for ${countyName}. Check countyName selector.`,
            county: county.countySlug,
            countySlug: county.countySlug,
            countyName,
            query: meta?.query ?? null,
            elementsCount: meta?.elementsCount ?? 0,
            ...(meta || {}),
          },
          200
        );
      }

      const { filePath, data, downloaded } = loaded;
      const elementsCount = Array.isArray(data?.elements) ? data.elements.length : 0;
      if (elementsCount === 0) {
        return json(
          false,
          {
            ok: false,
            error: "OSM_EMPTY",
            hint: `No neighborhood candidates found for ${countyName}. Check countyName selector.`,
            county: county.countySlug,
            countySlug: county.countySlug,
            countyName,
            query: loaded?.query ?? null,
            elementsCount: 0,
          },
          200
        );
      }
      const debug =
        loaded?.queryHead && loaded?.postBodyHead
          ? { queryHead: String(loaded.queryHead), postBodyHead: String(loaded.postBodyHead) }
          : undefined;
      fileResults[county.countySlug] = { filePath, downloaded, totalElements: elementsCount, ...(debug ? { debug } : {}) };

      const candidates = citiesByCountySlug.get(county.countySlug) || [];
      if (!candidates.length) continue;
      const citySlugSet = new Set(
        candidates
          .map((c) => String(c.citySlug || c.slug || ""))
          .filter(Boolean)
      );
      const cityById = new Map<string, any>(candidates.map((c) => [String(c.id), c]));
      const maxRadiusKm = MAX_CITY_DISTANCE_KM_BY_COUNTY[county.countySlug] ?? 25;

      for (const el of data.elements) {
        const name = String(el.tags?.name || "").trim();
        if (!name) {
          skippedNoName += 1;
          continue;
        }

        const placeType = placeTypeForElement(el);
        if (!placeType) {
          skippedNoName += 1;
          continue;
        }
        if (placeType === "city" || placeType === "town") {
          skippedNoName += 1;
          continue;
        }

        const neighborhoodSlug = neighborhoodSlugFor(name);
        if (!neighborhoodSlug) {
          skippedNoName += 1;
          continue;
        }
        if (citySlugSet.has(neighborhoodSlug)) {
          skippedNoName += 1;
          continue;
        }

        let best: any = null;
        let bestDist = Number.POSITIVE_INFINITY;
        const inferredCityId = inferCityIdFromTags(el.tags, county.countySlug);
        if (inferredCityId) {
          const inferred = cityById.get(inferredCityId);
          if (inferred) {
            best = inferred;
            bestDist = 0;
          }
        }

          const center = elementCenter(el);
          if (!center) continue;
          if (!best) {
            for (const c of candidates) {
              const d = haversineKm(center, c.__centroid);
              if (d < bestDist) {
              bestDist = d;
              best = c;
            }
          }
        }

        if (!best) {
          unmatched += 1;
          continue;
        }
        if (bestDist > maxRadiusKm) {
          unmatched += 1;
          continue;
        }

        const citySlug = String(best.citySlug || best.slug || "");
        if (!citySlug) {
          unmatched += 1;
          continue;
        }

        const cityKey = `${county.countySlug}__${citySlug}`;
        const dedupMap = bestByCitySlug.get(cityKey) || new Map<string, { data: any; score: number; name: string }>();
        bestByCitySlug.set(cityKey, dedupMap);

        const docId = `ca-${county.countySlug}-${citySlug}-${neighborhoodSlug}`;
        const ref = db.collection("geo_neighborhoods").doc(docId);
        const placeTypeNormalized = placeType === "admin10" ? "admin10" : placeType;
        const score = candidateScore(placeTypeNormalized, true, name);

        const dataRecord = {
          state: "CA",
          stateCode: "CA",
          stateId: "CA",

          countyId: best.countyId || `ca-${county.countySlug}`,
          countySlug: county.countySlug,
          countyName: best.countyName || best.county || null,

          cityId: best.id,
          citySlug,
          cityName: best.cityName || best.name,

          neighborhoodName: name,
          name,
          neighborhoodSlug,
          slug: neighborhoodSlug,

          lat: center.lat,
          lon: center.lon,
          centroid: { lat: center.lat, lng: center.lon },

          source: "osm",
          sourceDetail: placeTypeNormalized === "admin10" ? "osm_admin10" : "osm_place",
          sourceId: `${el.type}/${el.id}`,
          placeType: placeTypeNormalized,
          importanceTier: importanceTierFor(placeTypeNormalized),
          osm: { type: el.type, id: el.id, place: el.tags?.place || null },

          updatedAtMs: nowMs,
          createdAtMs: nowMs,
        };

        const existing = dedupMap.get(neighborhoodSlug);
        if (!existing || score > existing.score) {
          dedupMap.set(neighborhoodSlug, { data: { ref, data: dataRecord }, score, name });
        }
      }
    }

    try {
      const writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: any }> = [];
      bestByCitySlug.forEach((bySlug) => {
        bySlug.forEach((entry) => {
          writes.push(entry.data);
          if (sampleNames.length < 15) sampleNames.push(entry.name);
        });
      });
      imported = writes.length;

      const chunkSize = 400;
      for (let i = 0; i < writes.length; i += chunkSize) {
        const chunk = writes.slice(i, i + chunkSize);
        const existing = await db.getAll(...chunk.map((w) => w.ref));
        existing.forEach((snap) => {
          if (snap.exists) updated += 1;
          else inserted += 1;
        });
        const batch = db.batch();
        chunk.forEach((w) => batch.set(w.ref, w.data, { merge: true }));
        await batch.commit();
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      const code = String(err?.code || "");
      const quotaLike =
        code.includes("resource-exhausted") ||
        msg.toLowerCase().includes("quota") ||
        msg.toLowerCase().includes("resource exhausted");
      return json(
        false,
        {
          error: quotaLike ? "FIRESTORE_QUOTA" : "WRITE_FAILED",
          detail: msg,
          inserted,
          updated,
          imported,
          unmatched,
          skippedNoName,
          sampleNames,
        },
        500
      );
    }

    await cfgRef.set({ locked: true, lockedAt: Timestamp.now(), lockedBy: auth.email || auth.uid || "admin" }, { merge: true });

    return json(
      true,
      {
        imported,
        inserted,
        updated,
        unmatched,
        skippedNoName,
        sampleNames,
        counties: TARGET_COUNTIES.map((c) => c.countySlug),
        files: fileResults,
      },
      200
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Import failed", stack: err?.stack || null }, { status: 500 });
  }
}

