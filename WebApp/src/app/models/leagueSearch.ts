export type LeagueSearchItem = {
  id: number;
  name: string;
  type?: string;
  logo?: string;
  country?: string;
  country_flag?: string;
};

export type LeagueSearchResult = {
  leagues: LeagueSearchItem[];
  truncated: boolean;
  limit: number;
};
