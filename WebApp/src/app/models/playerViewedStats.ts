export interface PlayerViewedTeam {
  team_id: number;
  team_name: string;
  matches: number;
}

export interface PlayerViewedStats {
  player_id: number;
  player_name: string;
  matches: number;
  startXI_matches: number;
  goals: number;
  assists: number;
  teams: PlayerViewedTeam[];
  nationality: string | null;
  nationality_flag: string | null;
}
