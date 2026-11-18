export function officialStadiumLocationIds(locations: { id: string; stadium?: boolean }[]): Set<string> {
  return new Set(locations.filter((location) => location.stadium).map((location) => location.id));
}

export function matchAtOfficialStadium(
  locationId: string | null | undefined,
  stadiumIds: Set<string>,
  enabled: boolean,
): boolean {
  if (!enabled) {
    return true;
  }
  return !!locationId && stadiumIds.has(locationId);
}
