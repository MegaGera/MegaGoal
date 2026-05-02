/*
    Team interface for football teams
    - team: Information about the team
    - venue: Information about the stadium
    - seasons: Seasons played in different competitions
*/
import { SeasonTeam } from "./season"

export interface shortTeam {
    name: string,
    id: number,
    seasons: SeasonTeam[]
}

export interface Team {
    team: team,
    venue: venue,
    seasons: SeasonTeam[]
}

interface team {
    id: number,
    name: string,
    code: string | null,
    country: string,
    founded: number | null,
    national: boolean,
    logo: string
}

interface venue {
    id: number | null,
    name: string | null,
    address: string | null,
    city: string | null,
    capacity: number | null,
    surface: string | null,
    image: string | null
}