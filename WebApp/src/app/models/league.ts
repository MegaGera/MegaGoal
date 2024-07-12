/*
    League interface for football competitions
    - league: Information about the league
    - country: Information about the country of the league
*/
export interface League {
    league: league,
    country: country,
    seasons: seasons[]
}

interface league {
    id: number,
    name: string,
    type: string,
    logo: string
}

interface country {
    name: string,
    code: string,
    flag: string
}

interface seasons {
    year: number
}