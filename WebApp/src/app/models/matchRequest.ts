/*
    This interface is used to represent the request to create a new Match (without the _id)
*/
export interface MatchRequest {
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