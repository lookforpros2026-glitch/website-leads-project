import {
  urlNeighborhood,
  urlNeighborhoodService,
  urlPlace,
  urlPlaceService,
} from "./urls";

function toPlaceSlug(page: any): string {
  return (
    page.placeSlug ||
    page.place?.slug ||
    page.neighborhood?.slug ||
    page.neighborhoodSlug ||
    ""
  );
}

function toPlace(page: any): string {
  return page.zip || page.citySlug || page.city?.slug || "";
}

function toServiceKey(page: any): string {
  return page.service?.key || page.serviceKey || page.service?.slug || "";
}

function toCountySlug(page: any): string {
  return page.countySlug || page.county?.slug || page.market || "";
}

function toLastmodMs(page: any): number | null {
  const updated = page.updatedAt ?? page.publishedAt ?? page.createdAt;
  if (!updated) return null;
  if (typeof updated === "number") return updated;
  if (updated?.toMillis) return updated.toMillis();
  return null;
}

export function buildSitemapEntries(pages: any[], base: string) {
  const placeLastmod = new Map<string, number | null>();
  const placeServiceLastmod = new Map<string, number | null>();
  const neighborhoodLastmod = new Map<string, number | null>();
  const neighborhoodServiceEntries: Array<{ url: string; lastModified: number | null }> = [];

  for (const page of pages) {
    const county = toCountySlug(page);
    const place = toPlace(page);
    const serviceKey = toServiceKey(page);
    const placeSlug = toPlaceSlug(page);
    if (!county || !place) continue;

    const lastmod = toLastmodMs(page);

    const placeKey = `${county}|${place}`;
    const existingPlace = placeLastmod.get(placeKey);
    if (existingPlace == null || (lastmod != null && existingPlace < lastmod)) {
      placeLastmod.set(placeKey, lastmod);
    }

    if (serviceKey) {
      const psKey = `${county}|${place}|${serviceKey}`;
      const existingPs = placeServiceLastmod.get(psKey);
      if (existingPs == null || (lastmod != null && existingPs < lastmod)) {
        placeServiceLastmod.set(psKey, lastmod);
      }
    }

    if (placeSlug) {
      const nKey = `${county}|${place}|${placeSlug}`;
      const existingN = neighborhoodLastmod.get(nKey);
      if (existingN == null || (lastmod != null && existingN < lastmod)) {
        neighborhoodLastmod.set(nKey, lastmod);
      }
    }

    if (placeSlug && serviceKey) {
      const path = urlNeighborhoodService(county, place, placeSlug, serviceKey);
      neighborhoodServiceEntries.push({
        url: `${base}${path}`,
        lastModified: lastmod,
      });
    }
  }

  const aggregated: Array<{ url: string; lastModified: number | null }> = [];
  for (const [key, lastmod] of placeLastmod.entries()) {
    const [county, place] = key.split("|");
    aggregated.push({
      url: `${base}${urlPlace(county, place)}`,
      lastModified: lastmod,
    });
  }
  for (const [key, lastmod] of placeServiceLastmod.entries()) {
    const [county, place, serviceKey] = key.split("|");
    aggregated.push({
      url: `${base}${urlPlaceService(county, place, serviceKey)}`,
      lastModified: lastmod,
    });
  }
  for (const [key, lastmod] of neighborhoodLastmod.entries()) {
    const [county, place, placeSlug] = key.split("|");
    aggregated.push({
      url: `${base}${urlNeighborhood(county, place, placeSlug)}`,
      lastModified: lastmod,
    });
  }

  const allEntries = [...aggregated, ...neighborhoodServiceEntries];
  const byUrl = new Map<string, { url: string; lastModified: number | null }>();
  for (const entry of allEntries) {
    const existing = byUrl.get(entry.url);
    if (!existing) {
      byUrl.set(entry.url, entry);
      continue;
    }
    if (entry.lastModified != null && (existing.lastModified == null || existing.lastModified < entry.lastModified)) {
      existing.lastModified = entry.lastModified;
    }
  }

  const sorted = Array.from(byUrl.values()).sort((a, b) => {
    const la = a.url.length;
    const lb = b.url.length;
    if (la !== lb) return la - lb;
    return a.url.localeCompare(b.url);
  });

  return sorted.map((entry) => ({
    url: entry.url,
    lastModified: entry.lastModified != null ? new Date(entry.lastModified) : null,
  }));
}
