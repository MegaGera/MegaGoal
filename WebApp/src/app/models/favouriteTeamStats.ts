/*
    FavouriteTeamStats interface for favourite team statistics
    - Contains comprehensive stats about the user's most viewed team
    - Includes performance metrics, match highlights, and rival information
*/
import { Match } from "./match";

// Partial match data for landing page stats
export interface PartialMatchData {
  teams: {
    home: {
      id: number;
      name: string;
    };
    away: {
      id: number;
      name: string;
    };
  };
  goals: {
    home: number;
    away: number;
  };
  fixture?: {
    id: number;
    timestamp?: number;
  };
}

export interface FavouriteTeamStats {
  team_id: number;
  team_name: string;
  views_count: number;
  goals_scored: number;
  goals_conceded: number;
  matches_watched: number;
  win_rate: number;
  crazy_match?: PartialMatchData | Match; // Match with most goals (can be partial or full)
  biggest_rival?: {
    team_id: number;
    team_name: string;
    matches_played: number;
  };
  most_goals_in_match?: {
    match: Match;
    total_goals: number;
  };
  last_match?: Match; // Most recent match
  // Location-based stats
  most_viewed_location?: {
    location_name: string;
    views_count: number;
  } | null;
  home_stadium_times?: {
    location_name: string;
    views_count: number;
  } | null;
  away_stadium_support?: {
    location_name: string;
    views_count: number;
  } | null;
  total_away_stadium_visits?: number;
} 