import { urlNeighborhood, urlNeighborhoodService, urlPlace, urlPlaceService } from "./urls";

type PageLike = {
  slugPath?: string;
  slug?: string;
  market?: string;
  countySlug?: string;
  county?: { slug?: string } | string | null;
  zip?: string;
  citySlug?: string;
  city?: { slug?: string } | string | null;
  placeSlug?: string;
  place?: { slug?: string } | string | null;
  neighborhoodSlug?: string;
  neighborhood?: { slug?: string } | string | null;
  serviceKey?: string;
  serviceSlug?: string;
  service?: { key?: string; slug?: string } | string | null;
};

export function buildCanonicalPath(page: PageLike): string {
  const countySlug =
    page.countySlug ||
    (typeof page.county === "string"
      ? page.county
      : typeof page.county === "object" && page.county
      ? page.county.slug
      : "") ||
    page.market ||
    "";
  const zip = page.zip || "";
  const serviceKey =
    (typeof page.service === "string" ? page.service : page.service?.key) ||
    page.serviceKey ||
    (typeof page.service === "object" && page.service ? page.service.slug : "") ||
    page.serviceSlug ||
    "";
  const placeSlug =
    page.placeSlug ||
    (typeof page.place === "string"
      ? page.place
      : typeof page.place === "object" && page.place
      ? page.place.slug
      : "") ||
    (typeof page.neighborhood === "string"
      ? page.neighborhood
      : typeof page.neighborhood === "object" && page.neighborhood
      ? page.neighborhood.slug
      : "") ||
    page.neighborhoodSlug ||
    "";
  const citySlug =
    page.citySlug ||
    (typeof page.city === "string"
      ? page.city
      : typeof page.city === "object" && page.city
      ? page.city.slug
      : "") ||
    "";

  if (countySlug && zip && serviceKey && placeSlug) {
    return urlNeighborhoodService(countySlug, zip, placeSlug, serviceKey);
  }
  if (countySlug && citySlug && placeSlug && serviceKey) {
    return urlNeighborhoodService(countySlug, citySlug, placeSlug, serviceKey);
  }
  if (countySlug && citySlug && serviceKey) {
    return urlPlaceService(countySlug, citySlug, serviceKey);
  }
  if (countySlug && zip && serviceKey) {
    return urlPlaceService(countySlug, zip, serviceKey);
  }
  if (countySlug && citySlug && placeSlug) {
    return urlNeighborhood(countySlug, citySlug, placeSlug);
  }
  if (countySlug && zip && placeSlug) {
    return urlNeighborhood(countySlug, zip, placeSlug);
  }
  if (countySlug && zip) {
    return urlPlace(countySlug, zip);
  }
  if (countySlug && citySlug) {
    return urlPlace(countySlug, citySlug);
  }
  return page.slugPath || page.slug || "";
}
