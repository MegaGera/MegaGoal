/*
    GeneralStats interface for general statistics based on user's match data
    - Contains various stats about teams, matches, and locations
    - Based on the current search filters applied
*/
import { Match } from "./match";

export interface GeneralStats {
  king_of_draws?: {
    team_id: number;
    team_name: string;
    draw_percentage: number;
    draws_count: number;
    total_matches: number;
  };
  crazy_match?: Match;
  biggest_win_percentage?: {
    team_id: number;
    team_name: string;
    win_percentage: number;
    wins: number;
    total_matches: number;
  };
  biggest_lose_percentage?: {
    team_id: number;
    team_name: string;
    loss_percentage: number;
    losses: number;
    total_matches: number;
  };
  most_boring_team?: {
    team_id: number;
    team_name: string;
    avg_goals_per_match: number;
    total_goals: number;
    matches: number;
  };
  most_crazy_team?: {
    team_id: number;
    team_name: string;
    avg_goals_per_match: number;
    total_goals: number;
    matches: number;
  };
  most_watched_location?: {
    location_name: string;
    views_count: number;
  };
  most_watched_stadium?: {
    location_name: string;
    views_count: number;
  };
  top_goalscorer?: {
    player_id: number;
    player_name: string;
    goals: number;
    matches: number;
  };
  top_assist_provider?: {
    player_id: number;
    player_name: string;
    assists: number;
    matches: number;
  };
  most_watched_player?: {
    player_id: number;
    player_name: string;
    matches: number;
  };
} 