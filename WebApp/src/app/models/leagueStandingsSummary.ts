/** GET /league/standings/summary — one row for the league table UI */
export interface LeagueStandingsSummaryRow {
  position: number;
  team: {
    id: number;
    name: string;
    logo: string;
  };
  points: number;
  played: number;
  win: number;
  draw: number;
  lose: number;
}

export interface LeagueStandingsSummaryGroup {
  group: string | null;
  rows: LeagueStandingsSummaryRow[];
}

export interface LeagueStandingsSummaryResponse {
  league_id: number;
  season: number;
  groups: LeagueStandingsSummaryGroup[];
}
