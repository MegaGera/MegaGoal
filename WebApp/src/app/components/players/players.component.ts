import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamClose, jamSearch, jamSettingsAlt } from '@ng-icons/jam-icons';
import { ionFootball } from '@ng-icons/ionicons';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { StatsService } from '../../services/stats.service';
import { Match } from '../../models/match';
import { Location } from '../../models/location';
import { SeasonInfo } from '../../models/season';
import { LeagueStats, TeamsViewedStats } from '../../models/league';
import { PlayerViewedStats } from '../../models/playerViewedStats';
import { PlayerSearchItem } from '../../models/playerSearch';
import { PaginationComponent } from '../pagination/pagination.component';
import { FiltersHomeComponent } from '../filters-home/filters-home.component';
import { MobileFiltersInlineRowComponent } from '../mobile-filters-inline-row/mobile-filters-inline-row.component';
import { BasicPlayerStatCardComponent } from '../stats/basic-player-stat-card/basic-player-stat-card.component';
import { NATIONS_LEAGUE_IDS } from '../../config/topLeagues';
import { ListFiltersQuery, ListFiltersUrlSync, sameListFilters } from '../../utils/list-filters-query';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    NgTemplateOutlet,
    NgIconComponent,
    PaginationComponent,
    FiltersHomeComponent,
    MobileFiltersInlineRowComponent,
    BasicPlayerStatCardComponent,
  ],
  templateUrl: './players.component.html',
  styleUrl: './players.component.css',
  providers: [
    ImagesService,
    provideNgIconsConfig({ size: '1.2rem' }),
    provideIcons({ jamSettingsAlt, ionFootball, jamSearch, jamClose }),
  ],
})
export class PlayersComponent implements OnInit, OnDestroy {
  matchesOriginal: Match[] = [];
  matchesContextLoaded = false;

  players: PlayerViewedStats[] = [];
  playersLoaded = false;
  playersTotal = 0;
  playersPage = 1;
  readonly playersPerPage = 10;
  readonly skeletonPlayerSlots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  /** Filters stay hidden until the first players response; kept visible on later page loads. */
  filtersRevealed = false;

  leaguesViewed: LeagueStats[] = [];
  locations: Location[] = [];
  locationsFiltered: Location[] = [];
  stats: { teamsViewed: TeamsViewedStats[] } = { teamsViewed: [] };
  statsLoaded = false;
  leaguesLoaded = false;
  private locationsReady = false;
  private teamsAgainstReady = false;

  filterPanelChipSelected = 0;
  filterLeagueSelected: number[] = [];
  filterTeamSelected: number[] = [];
  filterTeamAgainstSelected: number[] = [];
  filterLocationSelected = '';

  seasons: SeasonInfo[] = [{ id: 0, text: 'All time' }];
  seasonsFiltered: SeasonInfo[] = [];
  filterSeasonSelected!: SeasonInfo;

  leaguesFiltered: LeagueStats[] = [];
  teamsFiltered: TeamsViewedStats[] = [];
  teamsAgainstViewed: TeamsViewedStats[] = [];
  teamsAgainstLoaded = true;

  isMobileView = false;
  mobileFiltersExpanded = false;

  playerSearchQuery = '';
  private playerSearchRequestId = 0;
  private playerSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchPlayersAll: PlayerViewedStats[] = [];
  private watchedSearchIds = new Set<number>();

  private lastStandardFiltersKey = '';
  private queryParamsSubscription?: Subscription;
  private filtersUrl: ListFiltersUrlSync;

  constructor(
    private megagoal: MegaGoalService,
    public images: ImagesService,
    private changeDetectorRef: ChangeDetectorRef,
    private statsService: StatsService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.filtersUrl = new ListFiltersUrlSync(this.router, this.route, false);
    this.queryParamsSubscription = this.route.queryParamMap.subscribe((params) => {
      if (this.filtersUrl.isOwnNavigationPending()) return;
      const incoming = this.filtersUrl.read(params);
      if (sameListFilters(incoming, this.currentFiltersQuery())) return;
      this.applyFiltersQuery(incoming);
      if (this.matchesContextLoaded) {
        this.teamsAgainstReady = false;
        this.updateFilteredArrays();
        this.filterPlayers();
      }
    });
  }

  get isPlayerSearchActive(): boolean {
    return this.playerSearchQuery.trim().length >= 2;
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateScreenSize();
  }

  private updateScreenSize(): void {
    this.isMobileView = window.innerWidth < 768;
  }

  toggleMobileFilters(): void {
    this.mobileFiltersExpanded = !this.mobileFiltersExpanded;
  }

  ngOnInit(): void {
    this.updateScreenSize();
    this.getAllMatchesContext();
    this.getLocations();
    this.getLeaguesStats();
    this.megagoal.logPageVisit('players').subscribe({
      next: () => {},
      error: (error) => console.error('Error logging page visit:', error),
    });
  }

  ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
    if (this.playerSearchTimer != null) {
      clearTimeout(this.playerSearchTimer);
      this.playerSearchTimer = null;
    }
  }

  private currentFiltersQuery(): ListFiltersQuery {
    return {
      chip: this.filterPanelChipSelected,
      leagues: this.filterLeagueSelected,
      teams: this.filterTeamSelected,
      vs: this.filterTeamAgainstSelected,
      seasonId: this.filterSeasonSelected?.id ?? 0,
      location: this.filterLocationSelected,
      order: 'date_desc',
    };
  }

  private applyFiltersQuery(filters: ListFiltersQuery): void {
    this.filterPanelChipSelected = filters.chip;
    this.filterLeagueSelected = filters.leagues;
    this.filterTeamSelected = filters.teams;
    this.filterTeamAgainstSelected = filters.vs;
    this.filterLocationSelected = filters.location;
    const season = this.seasons.find((item) => item.id === filters.seasonId);
    this.filterSeasonSelected = season ?? { id: filters.seasonId, text: '' };
    this.teamsAgainstReady = false;
  }

  private syncFiltersToUrl(): void {
    this.filtersUrl.write(this.currentFiltersQuery());
  }

  onPlayerSearchQueryChange(value: string): void {
    this.playerSearchQuery = value;
    this.schedulePlayerSearch();
  }

  clearPlayerSearch(): void {
    this.playerSearchQuery = '';
    this.playerSearchRequestId += 1;
    if (this.playerSearchTimer != null) {
      clearTimeout(this.playerSearchTimer);
      this.playerSearchTimer = null;
    }
    this.searchPlayersAll = [];
    this.watchedSearchIds = new Set();
    this.playersPage = 1;
    this.loadPlayersViewed();
  }

  showWatchedStats(player: PlayerViewedStats): boolean {
    if (!this.isPlayerSearchActive) {
      return true;
    }
    return this.watchedSearchIds.has(player.player_id);
  }

  private schedulePlayerSearch(): void {
    if (this.playerSearchTimer != null) {
      clearTimeout(this.playerSearchTimer);
    }

    const trimmed = this.playerSearchQuery.trim();
    if (trimmed.length < 2) {
      this.playerSearchRequestId += 1;
      this.searchPlayersAll = [];
      this.watchedSearchIds = new Set();
      this.playersPage = 1;
      this.loadPlayersViewed();
      return;
    }

    const currentRequest = ++this.playerSearchRequestId;
    this.playersLoaded = false;
    this.players = [];
    this.playersTotal = 0;
    this.playersPage = 1;

    this.playerSearchTimer = setTimeout(() => {
      this.playerSearchTimer = null;
      this.runMergedPlayerSearch(trimmed, currentRequest);
    }, 280);
  }

  private runMergedPlayerSearch(
    trimmed: string = this.playerSearchQuery.trim(),
    requestId: number = this.playerSearchRequestId,
  ): void {
    if (trimmed.length < 2) {
      return;
    }

    this.playersLoaded = false;
    const teams =
      this.filterTeamSelected.length > 0 ? this.filterTeamSelected : undefined;
    const against =
      this.filterTeamAgainstSelected.length > 0
        ? this.filterTeamAgainstSelected
        : undefined;

    forkJoin({
      watched: this.statsService
        .getPlayersViewed(
          this.filterPanelChipSelected,
          this.filterLeagueSelected,
          this.filterSeasonSelected?.id ?? 0,
          this.filterLocationSelected,
          teams,
          against,
          1,
          100,
          trimmed,
        )
        .pipe(
          catchError(() =>
            of({ results: [], page: 1, limit: 100, total: 0, total_pages: 0 }),
          ),
        ),
      catalog: this.megagoal
        .searchPlayers(trimmed, {
          teams,
          leagues:
            this.filterLeagueSelected.length > 0
              ? this.filterLeagueSelected
              : undefined,
          season: this.filterSeasonSelected?.id ?? 0,
          teamSelection: this.filterPanelChipSelected,
        })
        .pipe(
          catchError(() => of({ players: [], truncated: false, limit: 20 })),
        ),
    }).subscribe({
      next: ({ watched, catalog }) => {
        if (requestId !== this.playerSearchRequestId) return;

        const watchedResults = watched?.results ?? [];
        this.watchedSearchIds = new Set(
          watchedResults.map((player) => player.player_id),
        );

        const unseenCatalog = (catalog.players ?? [])
          .filter((item) => !this.watchedSearchIds.has(item.id))
          .map((item) => this.mapSearchItemToListPlayer(item));

        this.searchPlayersAll = [...watchedResults, ...unseenCatalog];
        this.playersTotal = this.searchPlayersAll.length;
        this.applySearchPage();
        this.playersLoaded = true;
        this.filtersRevealed = true;
        this.changeDetectorRef.detectChanges();
      },
      error: () => {
        if (requestId !== this.playerSearchRequestId) return;
        this.searchPlayersAll = [];
        this.watchedSearchIds = new Set();
        this.players = [];
        this.playersTotal = 0;
        this.playersLoaded = true;
        this.filtersRevealed = true;
        this.changeDetectorRef.detectChanges();
      },
    });
  }

  private applySearchPage(): void {
    const totalPages = Math.max(
      1,
      Math.ceil(this.searchPlayersAll.length / this.playersPerPage) || 1,
    );
    if (this.playersPage > totalPages) {
      this.playersPage = totalPages;
    }
    const start = (this.playersPage - 1) * this.playersPerPage;
    this.players = this.searchPlayersAll.slice(start, start + this.playersPerPage);
  }

  private mapSearchItemToListPlayer(item: PlayerSearchItem): PlayerViewedStats {
    return {
      player_id: item.id,
      player_name: item.name,
      matches: 0,
      startXI_matches: 0,
      goals: 0,
      assists: 0,
      teams:
        item.last_team && item.last_team_id != null
          ? [{ team_id: item.last_team_id, team_name: item.last_team, matches: 0 }]
          : item.last_team
            ? [{ team_id: -1, team_name: item.last_team, matches: 0 }]
            : [],
      nationality: item.nationality ?? null,
      nationality_flag: item.nationality_flag ?? null,
    };
  }

  getAllMatchesContext(): void {
    this.megagoal.getAllMatches(false).subscribe((result) => {
      this.matchesOriginal = result as Match[];
      this.matchesContextLoaded = true;
      this.populateSeasonsFromMatches();
      this.updateFilteredArrays();
      this.refreshStatsPipeline();
      this.changeDetectorRef.detectChanges();
    });
  }

  private populateSeasonsFromMatches(): void {
    const uniqueSeasons = [...new Set(this.matchesOriginal.map((m) => m.league.season))];
    uniqueSeasons.sort((a, b) => b - a);
    const seasonObjects: SeasonInfo[] = uniqueSeasons.map((season) => ({
      id: season,
      text: `${season}-${season + 1}`,
    }));
    this.seasons = [{ id: 0, text: 'All time' }, ...seasonObjects];
    const preferredSeasonId = this.filterSeasonSelected?.id ?? 0;
    this.filterSeasonSelected =
      this.seasons.find((season) => season.id === preferredSeasonId) ?? this.seasons[0];
    this.seasonsFiltered = [...this.seasons];
  }

  private matchInvolvesSelectedTeams(match: Match): boolean {
    if (this.filterTeamSelected.length === 0) return true;
    const sel = new Set(this.filterTeamSelected);
    return sel.has(match.teams.home.id) || sel.has(match.teams.away.id);
  }

  private matchPassesTeamAgainst(match: Match): boolean {
    if (this.filterTeamAgainstSelected.length === 0) return true;
    const h = match.teams.home.id;
    const a = match.teams.away.id;
    const p = new Set(this.filterTeamSelected);
    const q = new Set(this.filterTeamAgainstSelected);
    return (p.has(h) && q.has(a)) || (p.has(a) && q.has(h));
  }

  private appendTeamFilterForCrossFilters(matches: Match[]): Match[] {
    if (this.filterTeamSelected.length === 0) return matches;
    let m = matches.filter((x) => this.matchInvolvesSelectedTeams(x));
    if (this.filterTeamAgainstSelected.length > 0) {
      m = m.filter((x) => this.matchPassesTeamAgainst(x));
    }
    return m;
  }

  private standardFiltersKey(): string {
    const seasonId = this.filterSeasonSelected?.id ?? 0;
    const leagues = [...this.filterLeagueSelected].sort((a, b) => a - b).join(',');
    return [
      this.filterPanelChipSelected,
      leagues,
      seasonId,
      this.filterLocationSelected || '',
    ].join('|');
  }

  private applyStandardMatchFilters(matches: Match[]): Match[] {
    let m = matches;
    if (this.filterPanelChipSelected === 1) {
      m = m.filter((match) => !NATIONS_LEAGUE_IDS.includes(match.league.id));
    } else if (this.filterPanelChipSelected === 2) {
      m = m.filter((match) => NATIONS_LEAGUE_IDS.includes(match.league.id));
    }
    if (this.filterLeagueSelected.length > 0) {
      m = m.filter((match) => this.filterLeagueSelected.includes(match.league.id));
    }
    const seasonId = this.filterSeasonSelected?.id ?? 0;
    if (seasonId !== 0) {
      m = m.filter((match) => match.league.season === seasonId);
    }
    if (this.filterLocationSelected) {
      m = m.filter((match) => match.location === this.filterLocationSelected);
    }
    return m;
  }

  private rebuildTeamsFiltered(): void {
    const m = this.applyStandardMatchFilters([...this.matchesOriginal]);
    const ids = new Set<number>();
    for (const match of m) {
      ids.add(match.teams.home.id);
      ids.add(match.teams.away.id);
    }
    this.teamsFiltered = this.stats.teamsViewed.filter((t) => ids.has(t.team_id));
  }

  private updateFilteredArrays(): void {
    let seasonsFilteredMatches = this.matchesOriginal;
    if (this.filterPanelChipSelected === 1) {
      seasonsFilteredMatches = seasonsFilteredMatches.filter(
        (match) => !NATIONS_LEAGUE_IDS.includes(match.league.id),
      );
    } else if (this.filterPanelChipSelected === 2) {
      seasonsFilteredMatches = seasonsFilteredMatches.filter((match) =>
        NATIONS_LEAGUE_IDS.includes(match.league.id),
      );
    }
    if (this.filterLeagueSelected.length > 0) {
      seasonsFilteredMatches = seasonsFilteredMatches.filter((match) =>
        this.filterLeagueSelected.includes(match.league.id),
      );
    }
    if (this.filterLocationSelected) {
      seasonsFilteredMatches = seasonsFilteredMatches.filter(
        (match) => match.location === this.filterLocationSelected,
      );
    }
    seasonsFilteredMatches = this.appendTeamFilterForCrossFilters(seasonsFilteredMatches);
    const availableSeasonIds = [
      ...new Set(seasonsFilteredMatches.map((match) => match.league.season)),
    ];
    this.seasonsFiltered = this.seasons.filter(
      (season) => season.id === 0 || availableSeasonIds.includes(season.id),
    );

    let leaguesFilteredMatches = this.matchesOriginal;
    if (this.filterPanelChipSelected === 1) {
      leaguesFilteredMatches = leaguesFilteredMatches.filter(
        (match) => !NATIONS_LEAGUE_IDS.includes(match.league.id),
      );
    } else if (this.filterPanelChipSelected === 2) {
      leaguesFilteredMatches = leaguesFilteredMatches.filter((match) =>
        NATIONS_LEAGUE_IDS.includes(match.league.id),
      );
    }
    if (this.filterSeasonSelected && this.filterSeasonSelected.id !== 0) {
      leaguesFilteredMatches = leaguesFilteredMatches.filter(
        (match) => match.league.season === this.filterSeasonSelected.id,
      );
    }
    if (this.filterLocationSelected) {
      leaguesFilteredMatches = leaguesFilteredMatches.filter(
        (match) => match.location === this.filterLocationSelected,
      );
    }
    leaguesFilteredMatches = this.appendTeamFilterForCrossFilters(leaguesFilteredMatches);
    const availableLeagueIds = [
      ...new Set(leaguesFilteredMatches.map((match) => match.league.id)),
    ];
    this.leaguesFiltered = this.leaguesViewed.filter((league) =>
      availableLeagueIds.includes(league.league_id),
    );

    let locationsFilteredMatches = this.matchesOriginal;
    if (this.filterPanelChipSelected === 1) {
      locationsFilteredMatches = locationsFilteredMatches.filter(
        (match) => !NATIONS_LEAGUE_IDS.includes(match.league.id),
      );
    } else if (this.filterPanelChipSelected === 2) {
      locationsFilteredMatches = locationsFilteredMatches.filter((match) =>
        NATIONS_LEAGUE_IDS.includes(match.league.id),
      );
    }
    if (this.filterSeasonSelected && this.filterSeasonSelected.id !== 0) {
      locationsFilteredMatches = locationsFilteredMatches.filter(
        (match) => match.league.season === this.filterSeasonSelected.id,
      );
    }
    if (this.filterLeagueSelected.length > 0) {
      locationsFilteredMatches = locationsFilteredMatches.filter((match) =>
        this.filterLeagueSelected.includes(match.league.id),
      );
    }
    locationsFilteredMatches = this.appendTeamFilterForCrossFilters(locationsFilteredMatches);
    const availableLocationIds = [
      ...new Set(locationsFilteredMatches.map((match) => match.location)),
    ];
    this.locationsFiltered = this.locations.filter((location) =>
      availableLocationIds.includes(location.id),
    );

    this.rebuildTeamsFiltered();
    this.cleanupInvalidSelections();
  }

  private cleanupInvalidSelections(): void {
    if (this.leaguesLoaded && this.matchesContextLoaded) {
      const availableLeagueIds = this.leaguesFiltered.map((league) => league.league_id);
      this.filterLeagueSelected = this.filterLeagueSelected.filter((leagueId) =>
        availableLeagueIds.includes(leagueId),
      );
    }

    if (this.locationsReady && this.matchesContextLoaded) {
      const availableLocationIds = this.locationsFiltered.map((location) => location.id);
      if (this.filterLocationSelected && !availableLocationIds.includes(this.filterLocationSelected)) {
        this.filterLocationSelected = '';
      }
    }

    if (this.matchesContextLoaded) {
      const availableSeasonIds = this.seasonsFiltered.map((season) => season.id);
      if (this.filterSeasonSelected && !availableSeasonIds.includes(this.filterSeasonSelected.id)) {
        this.filterSeasonSelected = this.seasonsFiltered[0] || this.seasons[0];
      }
    }

    if (this.statsLoaded) {
      const availableTeamIds = this.teamsFiltered.map((t) => t.team_id);
      this.filterTeamSelected = this.filterTeamSelected.filter((id: number) =>
        availableTeamIds.includes(id),
      );
    }

    if (this.teamsAgainstReady && this.filterTeamSelected.length > 0) {
      const againstIds = new Set(this.teamsAgainstViewed.map((t) => t.team_id));
      this.filterTeamAgainstSelected = this.filterTeamAgainstSelected.filter((id: number) =>
        againstIds.has(id),
      );
    }
    if (this.filterTeamSelected.length === 0) {
      this.filterTeamAgainstSelected = [];
    }
    this.syncFiltersToUrl();
  }

  getLocations(): void {
    this.megagoal.getLocationsCounts().subscribe({
      next: (result) => {
        this.locations = result as Location[];
        this.locationsReady = true;
        this.updateFilteredArrays();
      },
      error: () => {
        this.locations = [];
        this.locationsReady = true;
        this.updateFilteredArrays();
      },
    });
  }

  getLeaguesStats(): void {
    this.leaguesLoaded = false;
    this.statsService.getLeaguesViewed().subscribe({
      next: (result) => {
        this.leaguesViewed = result;
        this.leaguesLoaded = true;
        this.updateFilteredArrays();
        this.changeDetectorRef.detectChanges();
      },
      error: () => {
        this.leaguesViewed = [];
        this.leaguesLoaded = true;
        this.updateFilteredArrays();
        this.changeDetectorRef.detectChanges();
      },
    });
  }

  private refreshStatsPipeline(): void {
    const key = this.standardFiltersKey();
    const needPicker = key !== this.lastStandardFiltersKey || !this.statsLoaded;

    const afterPicker = (): void => {
      this.updateFilteredArrays();
      this.loadScopedTeamsAndPlayers();
    };

    if (needPicker) {
      this.lastStandardFiltersKey = key;
      this.statsLoaded = false;
      this.statsService
        .getTeamsViewed(
          this.filterPanelChipSelected,
          this.filterLeagueSelected,
          this.filterSeasonSelected?.id ?? 0,
          this.filterLocationSelected,
        )
        .subscribe({
          next: (result: TeamsViewedStats[]) => {
            this.stats.teamsViewed = result;
            this.statsLoaded = true;
            afterPicker();
          },
          error: () => {
            this.stats.teamsViewed = [];
            this.statsLoaded = true;
            afterPicker();
          },
        });
    } else {
      afterPicker();
    }
  }

  private loadScopedTeamsAndPlayers(): void {
    if (this.filterTeamSelected.length === 0) {
      this.teamsAgainstViewed = [];
      this.teamsAgainstLoaded = true;
      this.filterTeamAgainstSelected = [];
      this.loadPlayersViewed();
      this.changeDetectorRef.detectChanges();
      return;
    }

    this.teamsAgainstLoaded = false;
    this.statsService
      .getTeamsViewed(
        this.filterPanelChipSelected,
        this.filterLeagueSelected,
        this.filterSeasonSelected?.id ?? 0,
        this.filterLocationSelected,
        this.filterTeamSelected,
      )
      .subscribe({
        next: (rows: TeamsViewedStats[]) => {
          const primary = new Set(this.filterTeamSelected);
          this.teamsAgainstViewed = rows.filter((r) => !primary.has(r.team_id));
          this.teamsAgainstLoaded = true;
          this.teamsAgainstReady = true;
          this.cleanupInvalidSelections();
          this.updateFilteredArrays();
          this.loadPlayersViewed();
          this.changeDetectorRef.detectChanges();
        },
        error: () => {
          this.teamsAgainstViewed = [];
          this.teamsAgainstLoaded = true;
          this.teamsAgainstReady = true;
          this.filterTeamAgainstSelected = [];
          this.cleanupInvalidSelections();
          this.updateFilteredArrays();
          this.loadPlayersViewed();
          this.changeDetectorRef.detectChanges();
        },
      });
  }

  private loadPlayersViewed(): void {
    if (this.isPlayerSearchActive) {
      const requestId = ++this.playerSearchRequestId;
      this.runMergedPlayerSearch(this.playerSearchQuery.trim(), requestId);
      return;
    }

    this.playersLoaded = false;
    const teams =
      this.filterTeamSelected.length > 0 ? this.filterTeamSelected : undefined;
    const against =
      this.filterTeamAgainstSelected.length > 0
        ? this.filterTeamAgainstSelected
        : undefined;

    this.statsService
      .getPlayersViewed(
        this.filterPanelChipSelected,
        this.filterLeagueSelected,
        this.filterSeasonSelected?.id ?? 0,
        this.filterLocationSelected,
        teams,
        against,
        this.playersPage,
        this.playersPerPage,
      )
      .subscribe({
        next: (result) => {
          if (this.isPlayerSearchActive) {
            return;
          }
          this.players = result?.results ?? [];
          this.playersTotal = result?.total ?? 0;
          this.playersPage = result?.page ?? this.playersPage;
          this.playersLoaded = true;
          this.filtersRevealed = true;
          this.changeDetectorRef.detectChanges();
        },
        error: () => {
          if (this.isPlayerSearchActive) {
            return;
          }
          this.players = [];
          this.playersTotal = 0;
          this.playersLoaded = true;
          this.filtersRevealed = true;
          this.changeDetectorRef.detectChanges();
        },
      });
  }

  onPlayersPageChange(page: number): void {
    if (page === this.playersPage) {
      return;
    }
    this.playersPage = page;
    if (this.isPlayerSearchActive) {
      this.applySearchPage();
      this.changeDetectorRef.detectChanges();
      return;
    }
    this.loadPlayersViewed();
  }

  filterPlayers(): void {
    this.playersPage = 1;
    this.refreshStatsPipeline();
  }

  changeFilterPanelChipSelected(chip: number): void {
    this.filterPanelChipSelected = chip;
    this.teamsAgainstReady = false;
    this.filterPlayers();
    this.syncFiltersToUrl();
  }

  changeFilterLeagueSelected(leagues: number[]): void {
    this.filterLeagueSelected = leagues;
    this.teamsAgainstReady = false;
    this.filterPlayers();
    this.syncFiltersToUrl();
  }

  changeFilterSeasonSelected(season: SeasonInfo): void {
    this.filterSeasonSelected = season;
    this.teamsAgainstReady = false;
    this.filterPlayers();
    this.syncFiltersToUrl();
  }

  changeFilterLocationSelected(location: string): void {
    this.filterLocationSelected = location;
    this.teamsAgainstReady = false;
    this.filterPlayers();
    this.syncFiltersToUrl();
  }

  changeFilterTeamSelected(teams: number[]): void {
    this.filterTeamSelected = teams;
    this.teamsAgainstReady = false;
    if (teams.length === 0) {
      this.filterTeamAgainstSelected = [];
    }
    this.filterPlayers();
    this.syncFiltersToUrl();
  }

  changeFilterTeamAgainstSelected(ids: number[]): void {
    this.filterTeamAgainstSelected = ids;
    this.filterPlayers();
    this.syncFiltersToUrl();
  }

  resetFilters(): void {
    this.filterPanelChipSelected = 0;
    this.filterLeagueSelected = [];
    this.filterTeamSelected = [];
    this.filterTeamAgainstSelected = [];
    this.teamsAgainstReady = false;
    this.filterLocationSelected = '';
    this.filterSeasonSelected = this.seasons[0];
    this.filterPlayers();
    this.syncFiltersToUrl();
  }

  trackByPlayerId(_index: number, player: PlayerViewedStats): number {
    return player.player_id;
  }

  playerRank(player: PlayerViewedStats): number {
    if (this.isPlayerSearchActive) {
      const index = this.searchPlayersAll.findIndex(
        (p) => p.player_id === player.player_id,
      );
      return index >= 0 ? index + 1 : 0;
    }
    const index = this.players.findIndex((p) => p.player_id === player.player_id);
    if (index < 0) {
      return 0;
    }
    return (this.playersPage - 1) * this.playersPerPage + index + 1;
  }
}
