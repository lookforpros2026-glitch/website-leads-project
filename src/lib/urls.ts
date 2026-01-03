export function urlPlace(countySlug: string, place: string) {
  return `/${countySlug}/${place}`;
}

export function urlPlaceService(countySlug: string, place: string, serviceKey: string) {
  return `/${countySlug}/${place}/s/${serviceKey}`;
}

export function urlNeighborhood(countySlug: string, place: string, placeSlug: string) {
  return `/${countySlug}/${place}/n/${placeSlug}`;
}

export function urlNeighborhoodService(
  countySlug: string,
  place: string,
  placeSlug: string,
  serviceKey: string
) {
  return `/${countySlug}/${place}/n/${placeSlug}/${serviceKey}`;
}
