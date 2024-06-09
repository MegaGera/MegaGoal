/*
    Match interface for football matches viewed
*/
export interface Match {
    fixture: {
        id: number,
        timestamp: number
    },
    league: {
        id: number,
        name: string,
        round: string,
        season: number
    },
    teams: {
        home: {
            id: number,
            name: string
        },
        away: {
            id: number,
            name: string
        }
    },
    goals: {
        home: number,
        away: number
    },
    location: string
}