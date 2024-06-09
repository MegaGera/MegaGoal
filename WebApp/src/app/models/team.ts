/*
    Team interface for football teams
    - team: Information about the team
    - venue: Information about the stadium
    - seasons: Seasons played in different competitions
*/
import { SeasonTeam } from "./season"

export interface Team {
    team: team,
    venue: venue,
    seasons: SeasonTeam[]
}

interface team {
    id: number,
    name: string,
    code: string,
    country: string,
    founded: number,
    national: boolean,
    logo: string
}

interface venue {
    id: number,
    name: string,
    address: string,
    city: string,
    capacity: number,
    surface: string,
    image: string
}