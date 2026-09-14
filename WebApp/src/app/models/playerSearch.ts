export type PlayerSearchItem = {
  id: number;
  name: string;
  photo?: string;
  position?: string;
  nationality?: string;
  nationality_flag?: string;
  last_team?: string;
  last_team_id?: number;
};

export type PlayerSearchResult = {
  players: PlayerSearchItem[];
  truncated: boolean;
  limit: number;
};
