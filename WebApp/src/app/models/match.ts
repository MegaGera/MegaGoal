/*
    Match interface for football matches viewed (with the _id)
*/
import { TeamStatistics } from './realMatch';

export interface MatchPlayerPick {
    id: number;
    name: string;
    team_id: number;
    team_name?: string;
}

export type PlayerPickKey = 'mvp' | 'bluff' | 'underrated' | 'most_entertaining';

export const MATCH_REACTIONS = [
  '🔥',
  '😭',
  '🤩',
  '😡',
  '🍿',
  '😴',
  '🤯',
  '🚌'
] as const;

export type MatchReaction = (typeof MATCH_REACTIONS)[number];

export interface MatchUserPicks {
    rating?: number | null;
    mvp?: MatchPlayerPick | null;
    bluff?: MatchPlayerPick | null;
    underrated?: MatchPlayerPick | null;
    most_entertaining?: MatchPlayerPick | null;
}

export interface MatchReactionCount {
    reaction: MatchReaction;
    count: number;
}

export interface MatchPlayerVoteCount extends MatchPlayerPick {
    votes: number;
}

export interface MatchEngagementAggregate {
    fixture_id: number;
    reactions: MatchReactionCount[];
    rating: {
        average: number | null;
        count: number;
    };
    player_votes: Record<PlayerPickKey, MatchPlayerVoteCount[]>;
}

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
    },
    user_picks?: MatchUserPicks,
    reactions?: MatchReaction[],
    /** Global users who marked this fixture as watched; present only when requested (e.g. home list). */
    watched_count?: number
}