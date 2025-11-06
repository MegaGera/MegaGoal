import { Match } from './match';

export interface PlayerStats {
  player_id: number;
  matches_viewed: number;
  matches_startXI: number;
  total_goals: number;
  total_assists: number;
  different_teams_watched: number;
  win_percentage: number;
  draw_percentage: number;
  loss_percentage: number;
  yellow_cards: number;
  red_cards: number;
  wins: number;
  draws: number;
  losses: number;
  seasons?: SeasonStats[];
}

export interface SeasonStats {
  season: number;
  teams: TeamSeasonStats[];
}

export interface TeamSeasonStats {
  team_id: number;
  team_name: string;
  matches: Match[];
  matches_viewed: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
}

