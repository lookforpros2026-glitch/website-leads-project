import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authz";
import { getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const COUNTY_LABELS: Record<string, string> = {
  "los-angeles": "Los Angeles County, California, USA",
  orange: "Orange County, California, USA",
  ventura: "Ventura County, California, USA",
  "san-bernardino": "San Bernardino County, California, USA",
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
] as const;

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

function buildQuery(areaQuery: string) {
  return `
[out:json][timeout:180];
{{geocodeArea:${areaQuery}}}->.a;
(
  nwr["place"~"^(neighbourhood|suburb)$"](area.a);
);
out center;
`.trim();
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const db = getAdminDb();
  const cfgSnap = await db.collection("config").doc("geo").get();
  const locked = cfgSnap.exists ? (cfgSnap.data() as any).locked !== false : true;
  if (locked) {
    return NextResponse.json({ ok: false, error: "GEO_LOCKED" }, { status: 423 });
  }

  const url = new URL(req.url);
  const countySlug = (url.searchParams.get("countySlug") || "").toLowerCase();
  const areaQuery = COUNTY_LABELS[countySlug];
  if (!areaQuery) {
    return NextResponse.json({ ok: false, error: "INVALID_COUNTY", allowed: Object.keys(COUNTY_LABELS) }, { status: 400 });
  }

  const query = buildQuery(areaQuery);

  try {
    let lastNetworkOr5xx: any = null;

    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body: `data=${encodeURIComponent(query)}`,
        });

        const contentType = res.headers.get("content-type") || "";
        const status = res.status;

        if (!res.ok || !contentType.toLowerCase().includes("application/json")) {
          const raw = await res.text().catch(() => "");
          const overpassError = contentType.toLowerCase().includes("text/html") ? extractOverpassHtmlError(raw) : null;

          if (status >= 500) {
            lastNetworkOr5xx = { endpoint, status, contentType, overpassError, rawSnippet: raw.slice(0, 800) };
            continue;
          }

          return NextResponse.json(
            {
              ok: false,
              error: !res.ok ? "OVERPASS_FAILED" : "OVERPASS_NON_JSON",
              endpoint,
              countySlug,
              status,
              contentType,
              overpassError,
              query,
              rawSnippet: raw.slice(0, 800),
            },
            { status: 502 }
          );
        }

        const data = (await res.json()) as any;
        const elements = Array.isArray(data?.elements) ? data.elements : [];
        const sampleNames = elements
          .map((e: any) => String(e?.tags?.name || "").trim())
          .filter(Boolean)
          .slice(0, 5);

        return NextResponse.json(
          {
            ok: true,
            endpoint,
            countySlug,
            status,
            contentType,
            elementsCount: elements.length,
            sampleNames,
            query,
          },
          { status: 200 }
        );
      } catch (err: any) {
        lastNetworkOr5xx = { endpoint, error: String(err?.message || err) };
        continue;
      }
    }

    return NextResponse.json(
      { ok: false, error: "OVERPASS_FAILED", countySlug, query, lastNetworkOr5xx, hint: "All Overpass endpoints failed (network/5xx)." },
      { status: 502 }
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "DEBUG_FAILED", stack: err?.stack || null }, { status: 500 });
  }
}

