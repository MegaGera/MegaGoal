export interface LeaguesSettings {
    league_id: number,
    league_name: string,
    update_frequency: number,
    last_update: Date,
    next_match: Date,
    is_active: boolean,
    last_daily_update: Date,
    daily_update: boolean,
    season: number,
    position: number,
    colors?: {
        base_color?: string,
        card_main_color?: string,
        card_trans_color?: string
    },
    available_seasons?: {
        season: number,
        real_matches: number,
        teams: number,
        players?: number,
        lineups?: number,
        events?: number,
        statistics?: number
    }[]
}