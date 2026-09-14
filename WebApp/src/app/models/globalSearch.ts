export type GlobalSearchEntityType = 'team' | 'player' | 'league';

export type GlobalSearchResultItem = {
  type: GlobalSearchEntityType;
  id: number;
  name: string;
  /** True when the hit comes from the user's watched data. */
  watched: boolean;
  /** Watched appearances (matches for teams/players, views for leagues). */
  count: number | null;
  subtitle?: string | null;
  flagUrl?: string | null;
  goals?: number | null;
  assists?: number | null;
};

export type GlobalSearchResult = {
  items: GlobalSearchResultItem[];
  limit: number;
};

export const GLOBAL_SEARCH_LIMIT = 20;
