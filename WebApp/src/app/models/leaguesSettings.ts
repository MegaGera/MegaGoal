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
    available_seasons?: number[]
}