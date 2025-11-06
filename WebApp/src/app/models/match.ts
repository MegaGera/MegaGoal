/*
    Match interface for football matches viewed (with the _id)
*/
import { TeamStatistics } from './realMatch';

export interface Match {
    _id: string,
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
    location: string,
    status: string,
    venue?: {
        id: number,
        name: string
    },
    statistics?: TeamStatistics[],
    player_stats?: {
        started: boolean,
        goals: number,
        assists: number,
        yellow_cards: number,
        red_cards: number
    }
}