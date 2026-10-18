import { ActivatedRoute, ParamMap, Router } from '@angular/router';

export type ListFilterOrder = 'date_desc' | 'date_asc' | 'goals_desc' | 'goals_asc';

/** Filter fields shared by Home, Players, and Teams. Defaults are omitted from the URL. */
export interface ListFiltersQuery {
  chip: number;
  leagues: number[];
  teams: number[];
  vs: number[];
  seasonId: number;
  location: string;
  order: ListFilterOrder;
}

const ORDERS: ListFilterOrder[] = ['date_desc', 'date_asc', 'goals_desc', 'goals_asc'];

export function emptyListFiltersQuery(): ListFiltersQuery {
  return {
    chip: 0,
    leagues: [],
    teams: [],
    vs: [],
    seasonId: 0,
    location: '',
    order: 'date_desc',
  };
}

export function listFiltersFromParamMap(
  params: ParamMap,
  includeOrder: boolean,
): ListFiltersQuery {
  const filters = emptyListFiltersQuery();

  const chip = params.get('chip');
  if (chip === '1' || chip === '2') {
    filters.chip = +chip;
  }

  const leagues = params.get('leagues');
  if (leagues) {
    filters.leagues = parseIds(leagues);
  }

  const teams = params.get('teams');
  if (teams) {
    filters.teams = parseIds(teams);
  }

  const vs = params.get('vs');
  if (vs) {
    filters.vs = parseIds(vs);
  }

  const season = params.get('season');
  if (season != null && season !== '' && !Number.isNaN(+season)) {
    filters.seasonId = +season;
  }

  const location = params.get('location');
  if (location) {
    filters.location = location;
  }

  if (includeOrder) {
    const order = params.get('order');
    if (order && ORDERS.includes(order as ListFilterOrder)) {
      filters.order = order as ListFilterOrder;
    }
  }

  return filters;
}

export function listFiltersToQueryParams(
  filters: ListFiltersQuery,
  includeOrder: boolean,
): Record<string, string> {
  const queryParams: Record<string, string> = {};

  if (filters.chip === 1 || filters.chip === 2) {
    queryParams['chip'] = String(filters.chip);
  }
  if (filters.leagues.length > 0) {
    queryParams['leagues'] = filters.leagues.join(',');
  }
  if (filters.teams.length > 0) {
    queryParams['teams'] = filters.teams.join(',');
  }
  if (filters.vs.length > 0) {
    queryParams['vs'] = filters.vs.join(',');
  }
  if (filters.seasonId !== 0) {
    queryParams['season'] = String(filters.seasonId);
  }
  if (filters.location) {
    queryParams['location'] = filters.location;
  }
  if (includeOrder && filters.order !== 'date_desc') {
    queryParams['order'] = filters.order;
  }

  return queryParams;
}

export function sameListFilters(a: ListFiltersQuery, b: ListFiltersQuery): boolean {
  return (
    a.chip === b.chip &&
    sameIds(a.leagues, b.leagues) &&
    sameIds(a.teams, b.teams) &&
    sameIds(a.vs, b.vs) &&
    a.seasonId === b.seasonId &&
    a.location === b.location &&
    a.order === b.order
  );
}

/** Writes filter query params with replaceUrl, and ignores the navigation those writes produce. */
export class ListFiltersUrlSync {
  private localWriteId = 0;
  private appliedWriteId = 0;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private includeOrder: boolean,
  ) {}

  read(params: ParamMap): ListFiltersQuery {
    return listFiltersFromParamMap(params, this.includeOrder);
  }

  isOwnNavigationPending(): boolean {
    return this.localWriteId !== this.appliedWriteId;
  }

  write(filters: ListFiltersQuery): void {
    const current = this.read(this.route.snapshot.queryParamMap);
    if (sameListFilters(filters, current)) {
      return;
    }
    const id = ++this.localWriteId;
    void this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: listFiltersToQueryParams(filters, this.includeOrder),
        replaceUrl: true,
      })
      .then((succeeded) => {
        if (succeeded && id === this.localWriteId) {
          this.appliedWriteId = id;
        }
      });
  }
}

function parseIds(value: string): number[] {
  return value
    .split(',')
    .map((id) => +id)
    .filter((id) => !Number.isNaN(id));
}

function sameIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort((x, y) => x - y);
  const right = [...b].sort((x, y) => x - y);
  return left.every((id, index) => id === right[index]);
}
