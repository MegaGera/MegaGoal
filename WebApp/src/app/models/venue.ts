/*
    Venue interface for football stadiums/venues
*/
export interface Venue {
    id: number,
    name: string,
    address: string | null,
    city: string | null,
    country: string,
    capacity: number | null,
    surface: string | null,
    image: string | null
}

export interface VenueCountry {
    name: string,
    code: string | null,
    flag: string | null,
    venueCount: number
} 