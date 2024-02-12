/*
    Season interface for season selector in page /leagues
*/
export interface SeasonInfo {
    id: number,
    text: string
}

/*
    Season interface for Team interface
*/
export interface SeasonTeam {
    league: string,
    season: string
}