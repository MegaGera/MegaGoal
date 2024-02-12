/*
    Match interface for football matches viewed
*/
export interface Match {
    _id: string,
    team_0: string,
    team_1: string,
    team_0_id: string,
    team_1_id: string,
    team_0_goals: number,
    team_1_goals: number,
    competition: string,
    competition_id: string,
    round: string,
    season: string,
    location: string,
    date: string
}