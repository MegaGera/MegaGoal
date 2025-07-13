/*
    FavouriteTeamStats interface for favourite team statistics
    - Contains comprehensive stats about the user's most viewed team
    - Includes performance metrics, match highlights, and rival information
*/
import { Match } from "./match";

export interface FavouriteTeamStats {
  team_id: number;
  team_name: string;
  views_count: number;
  goals_scored: number;
  goals_conceded: number;
  matches_watched: number;
  win_rate: number;
  crazy_match?: Match; // Match with most goals
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
  };
  home_stadium_times?: {
    location_name: string;
    views_count: number;
  };
  away_stadium_support?: {
    location_name: string;
    views_count: number;
  };
  total_away_stadium_visits?: number;
} 