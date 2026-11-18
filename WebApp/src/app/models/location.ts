export interface LocationPlace {
    provider: 'osm',
    lat: number,
    lng: number,
    osmId?: string,
    osmType?: 'N' | 'W' | 'R',
    osmName?: string,
    formattedAddress?: string
}

export interface LocationPlaceResult {
    osmId: string,
    osmType: 'N' | 'W' | 'R',
    name: string,
    formattedAddress: string,
    lat: number,
    lng: number
}

const LAST_MAP_PIN_KEY = 'megagoal.lastMapPin';

export function rememberMapPin(pin: { lat: number; lng: number }): void {
    try {
        localStorage.setItem(LAST_MAP_PIN_KEY, JSON.stringify({ lat: pin.lat, lng: pin.lng }));
    } catch {
        return;
    }
}

export function lastMapPin(): { lat: number; lng: number } | null {
    try {
        const raw = localStorage.getItem(LAST_MAP_PIN_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as { lat?: unknown; lng?: unknown };
        if (typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number') {
            return null;
        }
        if (parsed.lat < -90 || parsed.lat > 90 || parsed.lng < -180 || parsed.lng > 180) {
            return null;
        }
        return { lat: parsed.lat, lng: parsed.lng };
    } catch {
        return null;
    }
}

export const SANTIAGO_BERNABEU = { lat: 40.453054, lng: -3.688344 };

export const DEFAULT_MAP_STADIUMS = [
    { name: 'Santiago Bernabeu', lat: 40.453054, lng: -3.688344 },
    { name: 'Camp Nou', lat: 41.380896, lng: 2.122820 },
    { name: 'Allianz Arena', lat: 48.218775, lng: 11.624753 },
    { name: 'Wembley', lat: 51.556021, lng: -0.279519 },
    { name: 'San Siro', lat: 45.478489, lng: 9.123996 },
    { name: 'Old Trafford', lat: 53.463056, lng: -2.291389 },
    { name: 'Emirates Stadium', lat: 51.554867, lng: -0.108436 },
    { name: 'Anfield', lat: 53.430829, lng: -2.960830 },
    { name: 'Parc des Princes', lat: 48.841389, lng: 2.253056 },
    { name: 'Maracana', lat: -22.912167, lng: -43.230164 },
    { name: 'La Bombonera', lat: -34.635556, lng: -58.364722 }
];

export interface Location {
    name: string,
    id: string,
    user: {
        username: string,
    }
    private: boolean,
    stadium: boolean,
    official: boolean,
    matchCount: number,
    venue_id?: number,
    place?: LocationPlace
}