export type TeamSearchItem = {
  id: number;
  name: string;
  country?: string;
  country_flag?: string;
  logo?: string;
  national?: boolean;
};

export type TeamSearchResult = {
  teams: TeamSearchItem[];
  truncated: boolean;
  limit: number;
};
