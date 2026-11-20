const PHOTON_URL = 'https://photon.komoot.io/api/';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 100;
const LOCATION_BIAS_SCALE = 0.8;
const NOMINATIM_GAP_MS = 1100;
const USER_AGENT = 'MegaGoal/1.0 (https://megagoal.megagera.com)';
const OSM_TYPE_BY_NOMINATIM = { node: 'N', way: 'W', relation: 'R' };

let lastNominatimAt = 0;

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

const requestJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': USER_AGENT
    },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) {
    throw new Error(`Place search failed (${response.status})`);
  }
  return response.json();
};

const searchPhoton = async (query, bias) => {
  const url = new URL(PHOTON_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '6');
  if (bias) {
    url.searchParams.set('lat', String(bias.lat));
    url.searchParams.set('lon', String(bias.lng));
    url.searchParams.set('location_bias_scale', String(LOCATION_BIAS_SCALE));
  }
  const body = await requestJson(url);
  return (body.features ?? []).map(toPlaceResult).filter(Boolean);
};

const waitForNominatim = async () => {
  const wait = NOMINATIM_GAP_MS - (Date.now() - lastNominatimAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastNominatimAt = Date.now();
};

const toNominatimResult = (row) => {
  const osmType = OSM_TYPE_BY_NOMINATIM[row?.osm_type];
  const lat = Number(row?.lat);
  const lng = Number(row?.lon);
  if (!osmType || row?.osm_id == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  const name = row.name || String(row.display_name || '').split(',')[0].trim();
  if (!name) {
    return null;
  }
  return {
    osmId: String(row.osm_id),
    osmType,
    name,
    formattedAddress: row.display_name || name,
    lat,
    lng
  };
};

const searchNominatim = async (query, bias) => {
  await waitForNominatim();
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '6');
  if (bias) {
    const span = 0.6;
    url.searchParams.set('viewbox', `${bias.lng - span},${bias.lat + span},${bias.lng + span},${bias.lat - span}`);
    url.searchParams.set('bounded', '0');
  }
  const body = await requestJson(url);
  return (Array.isArray(body) ? body : []).map(toNominatimResult).filter(Boolean);
};

const searchPhotonPlaces = async (query, bias) => {
  const lat = bias?.lat;
  const lng = bias?.lng;
  const hasBias = Number.isFinite(lat) && Number.isFinite(lng);
  const point = hasBias ? { lat, lng } : null;
  const key = point
    ? `${query.trim().toLowerCase()}@${lat.toFixed(2)},${lng.toFixed(2)}`
    : query.trim().toLowerCase();
  const cached = readCache(key);
  if (cached) {
    return cached;
  }

  let results;
  try {
    results = await searchPhoton(query.trim(), point);
  } catch (error) {
    console.warn('Photon place search failed, using Nominatim:', error.cause?.code || error.message);
    results = await searchNominatim(query.trim(), point);
  }
  writeCache(key, results);
  return results;
};

export { searchPhotonPlaces };
