/*
    Match interface for football matches viewed
*/
export interface RealMatch {
    fixture: fixture,
    league: league,
    teams: teams,
    goals: goalsI,
    score: score,
    statistics?: TeamStatistics[],
    usernames?: string[]  // Array of usernames tracking this match
}

interface fixture {
    id: number,
    referee: string,
    timezone: string,
    date: string,
    timestamp: number,
    periods: {
        first: number,
        second: number
    },
    venue: {
        id: number,
        name: string,
        city: string
    },
    status: {
        long: string,
        short: string,
        elapsed: number
    }
}

interface league {
    id: number,
    name: string,
    country: string,
    logo: string,
    flag: string,
    season: number,
    round: string
}

interface teams {
    home: team,
    away: team
}

interface team {
    id: number,
    name: string,
    logo: string,
    winner: boolean
}

interface score {
    halftime: goalsI,
    fulltime: goalsI,
    extratime: goalsI,
    penalty: goalsI
}

interface goalsI {
    home: number,
    away: number
}

export interface TeamStatistics {
    team: {
        id: number,
        name: string,
        logo: string
    },
    statistics: Array<{
        type: string,
        value: number | string | null
    }>
}