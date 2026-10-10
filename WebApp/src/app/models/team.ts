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

/** Domestic league for the club’s latest season (from app leagues with type League + league_settings colors). */
export interface DomesticLeague {
    league: {
        id: number,
        name: string,
        type: string,
        logo: string
    },
    country: {
        name: string,
        code: string | null,
        flag: string | null
    },
    colors?: {
        base_color?: string,
        card_main_color?: string,
        card_trans_color?: string
    }
}

/** Current squad snapshot from API-Football /players/squads (stored on team docs). */
export interface SquadPlayer {
    id: number,
    name?: string | null,
    age?: number | null,
    number?: number | null,
    position?: string | null,
    photo?: string | null
}

export interface TeamSquad {
    players: SquadPlayer[],
    last_update?: Date | string | null
}

export interface Team {
    team: team,
    venue: venue,
    seasons: SeasonTeam[],
    domestic_league?: DomesticLeague | null,
    squad?: TeamSquad
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