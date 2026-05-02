/*
    League interface for football competitions
    - league: Information about the league
    - country: Information about the country of the league
    - colors: optional league_settings palette (same shape as DomesticLeague in team.ts)
*/
export interface League {
    league: league,
    country: country,
    seasons: seasons[],
    position?: number,
    colors?: {
        base_color?: string,
        card_main_color?: string,
        card_trans_color?: string
    }
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
    year: number,
    start: string,
    end: string,
    current: boolean,
    coverage: {
        fixtures: {
            events: boolean,
            lineups: boolean,
            statistics_fixtures: boolean,
            statistics_players: boolean
        },
        standings: boolean,
        players: boolean,
        top_scorers: boolean,
        top_assists: boolean,
        top_cards: boolean,
        injuries: boolean,
        predictions: boolean,
        odds: boolean
    }
}

export interface LeagueStats {
    league_id: number,
    league_name: string,
    count: number
}