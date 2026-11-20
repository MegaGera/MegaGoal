/*
    Venue interface for football stadiums/venues
*/
export interface VenuePlace {
    provider: 'osm',
    lat: number,
    lng: number,
    osmId?: string,
    osmType?: 'N' | 'W' | 'R',
    osmName?: string,
    formattedAddress?: string
}

export interface Venue {
    id: number,
    name: string,
    address: string | null,
    city: string | null,
    country: string,
    capacity: number | null,
    surface: string | null,
    image: string | null,
    place?: VenuePlace
}

export interface VenueCountry {
    name: string,
    code: string | null,
    flag: string | null,
    venueCount: number,
    pinnedCount: number
} 