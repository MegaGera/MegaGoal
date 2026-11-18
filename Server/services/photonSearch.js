const PHOTON_URL = 'https://photon.komoot.io/api/';
const BERNABEU_LAT = 40.453054;
const BERNABEU_LNG = -3.688344;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 100;

const cache = new Map();

const formatAddress = (properties) => {
  const street = [properties.housenumber, properties.street].filter(Boolean).join(' ');
  return [street, properties.district, properties.city || properties.locality, properties.state, properties.country]
    .filter(Boolean)
    .join(', ');
};

const toPlaceResult = (feature) => {
  const properties = feature?.properties ?? {};
  const coordinates = feature?.geometry?.coordinates;
  const osmType = properties.osm_type;
  const osmId = properties.osm_id;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }
  if (!['N', 'W', 'R'].includes(osmType) || osmId == null) {
    return null;
  }
  const [lng, lat] = coordinates;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return null;
  }
  const streetName = [properties.housenumber, properties.street].filter(Boolean).join(' ');
  const name = properties.name || streetName || properties.city || properties.country;
  if (!name) {
    return null;
  }
  const formattedAddress = formatAddress(properties);
  return {
    osmId: String(osmId),
    osmType,
    name,
    formattedAddress,
    lat,
    lng
  };
};

const readCache = (key) => {
  const hit = cache.get(key);
  if (!hit) {
    return null;
  }
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.results;
};

const writeCache = (key, results) => {
  cache.set(key, { at: Date.now(), results });
  if (cache.size <= CACHE_LIMIT) {
    return;
  }
  const oldestKey = cache.keys().next().value;
  cache.delete(oldestKey);
};

const searchPhotonPlaces = async (query) => {
  const key = query.trim().toLowerCase();
  const cached = readCache(key);
  if (cached) {
    return cached;
  }

  const url = new URL(PHOTON_URL);
  url.searchParams.set('q', query.trim());
  url.searchParams.set('limit', '6');
  url.searchParams.set('lat', String(BERNABEU_LAT));
  url.searchParams.set('lon', String(BERNABEU_LNG));

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'MegaGoal/1.0 (https://megagoal.megagera.com)'
    },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) {
    throw new Error('Photon search failed');
  }
  const body = await response.json();
  const results = (body.features ?? [])
    .map(toPlaceResult)
    .filter(Boolean);
  writeCache(key, results);
  return results;
};

export { searchPhotonPlaces };
