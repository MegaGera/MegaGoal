import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
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
import { TeamSearchItem } from '../../models/teamSearch';
import { PaginationComponent } from '../pagination/pagination.component';
import { FiltersHomeComponent } from '../filters-home/filters-home.component';
import { MobileFiltersInlineRowComponent } from '../mobile-filters-inline-row/mobile-filters-inline-row.component';
import { BasicTeamStatCardComponent } from '../stats/basic-team-stat-card/basic-team-stat-card.component';
import { NATIONS_LEAGUE_IDS } from '../../config/topLeagues';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    NgTemplateOutlet,
    NgIconComponent,
    PaginationComponent,
    FiltersHomeComponent,
    MobileFiltersInlineRowComponent,
    BasicTeamStatCardComponent,
  ],
  templateUrl: './teams.component.html',
  styleUrl: './teams.component.css',
  providers: [
    ImagesService,
    provideNgIconsConfig({ size: '1.2rem' }),
    provideIcons({ jamSettingsAlt, ionFootball, jamSearch, jamClose }),
  ],
})
export class TeamsComponent implements OnInit, OnDestroy {
  matchesOriginal: Match[] = [];
  matchesContextLoaded = false;

  teams: TeamsViewedStats[] = [];
  teamsListLoaded = false;
  teamsTotal = 0;
  teamsPage = 1;
  readonly teamsPerPage = 10;
  readonly skeletonTeamSlots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  /** Filters stay hidden until the first teams response; kept visible on later page loads. */
  filtersRevealed = false;

  leaguesViewed: LeagueStats[] = [];
  locations: Location[] = [];
  locationsFiltered: Location[] = [];
  stats: { teamsViewed: TeamsViewedStats[] } = { teamsViewed: [] };
  statsLoaded = false;
  leaguesLoaded = false;

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

  teamSearchQuery = '';
  private teamSearchRequestId = 0;
  private teamSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchTeamsAll: TeamsViewedStats[] = [];
  private watchedSearchIds = new Set<number>();

  private lastStandardFiltersKey = '';

  constructor(
    private megagoal: MegaGoalService,
    public images: ImagesService,
    private changeDetectorRef: ChangeDetectorRef,
    private statsService: StatsService,
  ) {}

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

  get isTeamSearchActive(): boolean {
    return this.teamSearchQuery.trim().length >= 2;
  }

  ngOnInit(): void {
    this.updateScreenSize();
    this.filterSeasonSelected = this.seasons[0];
    this.getAllMatchesContext();
    this.getLocations();
    this.getLeaguesStats();
    this.megagoal.logPageVisit('teams').subscribe({
      next: () => {},
      error: (error) => console.error('Error logging page visit:', error),
    });
  }

  ngOnDestroy(): void {
    if (this.teamSearchTimer != null) {
      clearTimeout(this.teamSearchTimer);
      this.teamSearchTimer = null;
    }
  }

  onTeamSearchQueryChange(value: string): void {
    this.teamSearchQuery = value;
    this.scheduleTeamSearch();
  }

  clearTeamSearch(): void {
    this.teamSearchQuery = '';
    this.teamSearchRequestId += 1;
    if (this.teamSearchTimer != null) {
      clearTimeout(this.teamSearchTimer);
      this.teamSearchTimer = null;
    }
    this.searchTeamsAll = [];
    this.watchedSearchIds = new Set();
    this.teamsPage = 1;
    this.loadTeamsViewed();
  }

  showWatchedStats(team: TeamsViewedStats): boolean {
    if (!this.isTeamSearchActive) {
      return true;
    }
    return this.watchedSearchIds.has(team.team_id);
  }

  private scheduleTeamSearch(): void {
    if (this.teamSearchTimer != null) {
      clearTimeout(this.teamSearchTimer);
    }

    const trimmed = this.teamSearchQuery.trim();
    if (trimmed.length < 2) {
      this.teamSearchRequestId += 1;
      this.searchTeamsAll = [];
      this.watchedSearchIds = new Set();
      this.teamsPage = 1;
      this.loadTeamsViewed();
      return;
    }

    const currentRequest = ++this.teamSearchRequestId;
    this.teamsListLoaded = false;
    this.teams = [];
    this.teamsTotal = 0;
    this.teamsPage = 1;

    this.teamSearchTimer = setTimeout(() => {
      this.teamSearchTimer = null;
      this.runMergedTeamSearch(trimmed, currentRequest);
    }, 280);
  }

  private runMergedTeamSearch(
    trimmed: string = this.teamSearchQuery.trim(),
    requestId: number = this.teamSearchRequestId,
  ): void {
    if (trimmed.length < 2) {
      return;
    }

    this.teamsListLoaded = false;
    const teams =
      this.filterTeamSelected.length > 0 ? this.filterTeamSelected : undefined;
    const against =
      this.filterTeamAgainstSelected.length > 0
        ? this.filterTeamAgainstSelected
        : undefined;

    forkJoin({
      watched: this.statsService
        .getTeamsViewedPage(
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
        .searchTeams(trimmed, {
          leagues:
            this.filterLeagueSelected.length > 0
              ? this.filterLeagueSelected
              : undefined,
          season: this.filterSeasonSelected?.id ?? 0,
          teamSelection: this.filterPanelChipSelected,
        })
        .pipe(
          catchError(() => of({ teams: [], truncated: false, limit: 20 })),
        ),
    }).subscribe({
      next: ({ watched, catalog }) => {
        if (requestId !== this.teamSearchRequestId) return;

        const watchedResults = watched?.results ?? [];
        this.watchedSearchIds = new Set(
          watchedResults.map((team) => team.team_id),
        );

        const unseenCatalog = (catalog.teams ?? [])
          .filter((item) => !this.watchedSearchIds.has(item.id))
          .map((item) => this.mapSearchItemToListTeam(item));

        this.searchTeamsAll = [...watchedResults, ...unseenCatalog];
        this.teamsTotal = this.searchTeamsAll.length;
        this.applySearchPage();
        this.teamsListLoaded = true;
        this.filtersRevealed = true;
        this.changeDetectorRef.detectChanges();
      },
      error: () => {
        if (requestId !== this.teamSearchRequestId) return;
        this.searchTeamsAll = [];
        this.watchedSearchIds = new Set();
        this.teams = [];
        this.teamsTotal = 0;
        this.teamsListLoaded = true;
        this.filtersRevealed = true;
        this.changeDetectorRef.detectChanges();
      },
    });
  }

  private applySearchPage(): void {
    const totalPages = Math.max(
      1,
      Math.ceil(this.searchTeamsAll.length / this.teamsPerPage) || 1,
    );
    if (this.teamsPage > totalPages) {
      this.teamsPage = totalPages;
    }
    const start = (this.teamsPage - 1) * this.teamsPerPage;
    this.teams = this.searchTeamsAll.slice(start, start + this.teamsPerPage);
  }

  private mapSearchItemToListTeam(item: TeamSearchItem): TeamsViewedStats {
    return {
      team_id: item.id,
      team_name: item.name,
      count: 0,
      total_goals: 0,
      country: item.country ?? null,
      country_flag: item.country_flag ?? null,
    };
  }

  getAllMatchesContext(): void {
    this.megagoal.getAllMatches(false).subscribe((result) => {
      this.matchesOriginal = result as Match[];
      this.populateSeasonsFromMatches();
      this.updateFilteredArrays();
      this.matchesContextLoaded = true;
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
    this.filterSeasonSelected = this.seasons[0];
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
    const availableLeagueIds = this.leaguesFiltered.map((league) => league.league_id);
    this.filterLeagueSelected = this.filterLeagueSelected.filter((leagueId) =>
      availableLeagueIds.includes(leagueId),
    );

    const availableLocationIds = this.locationsFiltered.map((location) => location.id);
    if (this.filterLocationSelected && !availableLocationIds.includes(this.filterLocationSelected)) {
      this.filterLocationSelected = '';
    }

    const availableSeasonIds = this.seasonsFiltered.map((season) => season.id);
    if (this.filterSeasonSelected && !availableSeasonIds.includes(this.filterSeasonSelected.id)) {
      this.filterSeasonSelected = this.seasonsFiltered[0] || this.seasons[0];
    }

    if (this.statsLoaded) {
      const availableTeamIds = this.teamsFiltered.map((t) => t.team_id);
      this.filterTeamSelected = this.filterTeamSelected.filter((id: number) =>
        availableTeamIds.includes(id),
      );
    }

    if (this.teamsAgainstLoaded && this.filterTeamSelected.length > 0) {
      const againstIds = new Set(this.teamsAgainstViewed.map((t) => t.team_id));
      this.filterTeamAgainstSelected = this.filterTeamAgainstSelected.filter((id: number) =>
        againstIds.has(id),
      );
    }
    if (this.filterTeamSelected.length === 0) {
      this.filterTeamAgainstSelected = [];
    }
  }

  getLocations(): void {
    this.megagoal.getLocationsCounts().subscribe((result) => {
      this.locations = result as Location[];
      this.updateFilteredArrays();
    });
  }

  getLeaguesStats(): void {
    this.leaguesLoaded = false;
    this.statsService.getLeaguesViewed().subscribe({
      next: (result) => {
        this.leaguesViewed = result;
        this.updateFilteredArrays();
        this.leaguesLoaded = true;
        this.changeDetectorRef.detectChanges();
      },
      error: () => {
        this.leaguesViewed = [];
        this.leaguesLoaded = true;
        this.changeDetectorRef.detectChanges();
      },
    });
  }

  private refreshStatsPipeline(): void {
    const key = this.standardFiltersKey();
    const needPicker = key !== this.lastStandardFiltersKey || !this.statsLoaded;

    const afterPicker = (): void => {
      this.updateFilteredArrays();
      this.loadScopedTeamsAndList();
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

  private loadScopedTeamsAndList(): void {
    if (this.filterTeamSelected.length === 0) {
      this.teamsAgainstViewed = [];
      this.teamsAgainstLoaded = true;
      this.filterTeamAgainstSelected = [];
      this.loadTeamsViewed();
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
          this.cleanupInvalidSelections();
          this.updateFilteredArrays();
          this.loadTeamsViewed();
          this.changeDetectorRef.detectChanges();
        },
        error: () => {
          this.teamsAgainstViewed = [];
          this.teamsAgainstLoaded = true;
          this.filterTeamAgainstSelected = [];
          this.cleanupInvalidSelections();
          this.updateFilteredArrays();
          this.loadTeamsViewed();
          this.changeDetectorRef.detectChanges();
        },
      });
  }

  private loadTeamsViewed(): void {
    if (this.isTeamSearchActive) {
      const requestId = ++this.teamSearchRequestId;
      this.runMergedTeamSearch(this.teamSearchQuery.trim(), requestId);
      return;
    }

    this.teamsListLoaded = false;
    const teams =
      this.filterTeamSelected.length > 0 ? this.filterTeamSelected : undefined;
    const against =
      this.filterTeamAgainstSelected.length > 0
        ? this.filterTeamAgainstSelected
        : undefined;

    this.statsService
      .getTeamsViewedPage(
        this.filterPanelChipSelected,
        this.filterLeagueSelected,
        this.filterSeasonSelected?.id ?? 0,
        this.filterLocationSelected,
        teams,
        against,
        this.teamsPage,
        this.teamsPerPage,
      )
      .subscribe({
        next: (result) => {
          this.teams = result?.results ?? [];
          this.teamsTotal = result?.total ?? 0;
          this.teamsPage = result?.page ?? this.teamsPage;
          this.teamsListLoaded = true;
          this.filtersRevealed = true;
          this.changeDetectorRef.detectChanges();
        },
        error: () => {
          this.teams = [];
          this.teamsTotal = 0;
          this.teamsListLoaded = true;
          this.filtersRevealed = true;
          this.changeDetectorRef.detectChanges();
        },
      });
  }

  onTeamsPageChange(page: number): void {
    if (page === this.teamsPage) {
      return;
    }
    this.teamsPage = page;
    if (this.isTeamSearchActive) {
      this.applySearchPage();
      this.changeDetectorRef.detectChanges();
      return;
    }
    this.loadTeamsViewed();
  }

  filterTeams(): void {
    this.teamsPage = 1;
    this.refreshStatsPipeline();
  }

  changeFilterPanelChipSelected(chip: number): void {
    this.filterPanelChipSelected = chip;
    this.filterTeams();
  }

  changeFilterLeagueSelected(leagues: number[]): void {
    this.filterLeagueSelected = leagues;
    this.filterTeams();
  }

  changeFilterSeasonSelected(season: SeasonInfo): void {
    this.filterSeasonSelected = season;
    this.filterTeams();
  }

  changeFilterLocationSelected(location: string): void {
    this.filterLocationSelected = location;
    this.filterTeams();
  }

  changeFilterTeamSelected(teams: number[]): void {
    this.filterTeamSelected = teams;
    if (teams.length === 0) {
      this.filterTeamAgainstSelected = [];
    }
    this.filterTeams();
  }

  changeFilterTeamAgainstSelected(ids: number[]): void {
    this.filterTeamAgainstSelected = ids;
    this.filterTeams();
  }

  resetFilters(): void {
    this.filterPanelChipSelected = 0;
    this.filterLeagueSelected = [];
    this.filterTeamSelected = [];
    this.filterTeamAgainstSelected = [];
    this.filterLocationSelected = '';
    this.filterSeasonSelected = this.seasons[0];
    this.filterTeams();
  }

  trackByTeamId(_index: number, team: TeamsViewedStats): number {
    return team.team_id;
  }

  teamRank(team: TeamsViewedStats): number {
    if (this.isTeamSearchActive) {
      const index = this.searchTeamsAll.findIndex((t) => t.team_id === team.team_id);
      return index >= 0 ? index + 1 : 0;
    }
    const index = this.teams.findIndex((t) => t.team_id === team.team_id);
    if (index < 0) {
      return 0;
    }
    return (this.teamsPage - 1) * this.teamsPerPage + index + 1;
  }
}
