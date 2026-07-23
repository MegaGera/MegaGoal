import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamSettingsAlt } from '@ng-icons/jam-icons';
import { ionFootball } from '@ng-icons/ionicons';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { StatsService } from '../../services/stats.service';
import { Match } from '../../models/match';
import { Location } from '../../models/location';
import { SeasonInfo } from '../../models/season';
import { LeagueStats, TeamsViewedStats } from '../../models/league';
import { PlayerViewedStats } from '../../models/playerViewedStats';
import { PaginationComponent } from '../pagination/pagination.component';
import { FiltersHomeComponent } from '../filters-home/filters-home.component';
import { MobileFiltersInlineRowComponent } from '../mobile-filters-inline-row/mobile-filters-inline-row.component';
import { BasicPlayerStatCardComponent } from '../stats/basic-player-stat-card/basic-player-stat-card.component';
import { NATIONS_LEAGUE_IDS } from '../../config/topLeagues';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    NgTemplateOutlet,
    NgIconComponent,
    PaginationComponent,
    MatProgressSpinnerModule,
    FiltersHomeComponent,
    MobileFiltersInlineRowComponent,
    BasicPlayerStatCardComponent,
  ],
  templateUrl: './players.component.html',
  styleUrl: './players.component.css',
  providers: [
    ImagesService,
    provideNgIconsConfig({ size: '1.2rem' }),
    provideIcons({ jamSettingsAlt, ionFootball }),
  ],
})
export class PlayersComponent implements OnInit {
  matchesOriginal: Match[] = [];
  matchesContextLoaded = false;

  players: PlayerViewedStats[] = [];
  playersFiltered: PlayerViewedStats[] = [];
  playersLoaded = false;

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

  ngOnInit(): void {
    this.updateScreenSize();
    this.filterSeasonSelected = this.seasons[0];
    this.getAllMatchesContext();
    this.getLocations();
    this.getLeaguesStats();
    this.megagoal.logPageVisit('players').subscribe({
      next: () => {},
      error: (error) => console.error('Error logging page visit:', error),
    });
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
          this.cleanupInvalidSelections();
          this.updateFilteredArrays();
          this.loadPlayersViewed();
          this.changeDetectorRef.detectChanges();
        },
        error: () => {
          this.teamsAgainstViewed = [];
          this.teamsAgainstLoaded = true;
          this.filterTeamAgainstSelected = [];
          this.cleanupInvalidSelections();
          this.updateFilteredArrays();
          this.loadPlayersViewed();
          this.changeDetectorRef.detectChanges();
        },
      });
  }

  private loadPlayersViewed(): void {
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
      )
      .subscribe({
        next: (result) => {
          this.players = result ?? [];
          this.playersLoaded = true;
          this.changeDetectorRef.detectChanges();
        },
        error: () => {
          this.players = [];
          this.playersLoaded = true;
          this.changeDetectorRef.detectChanges();
        },
      });
  }

  filterPlayers(): void {
    this.refreshStatsPipeline();
  }

  changeFilterPanelChipSelected(chip: number): void {
    this.filterPanelChipSelected = chip;
    this.filterPlayers();
  }

  changeFilterLeagueSelected(leagues: number[]): void {
    this.filterLeagueSelected = leagues;
    this.filterPlayers();
  }

  changeFilterSeasonSelected(season: SeasonInfo): void {
    this.filterSeasonSelected = season;
    this.filterPlayers();
  }

  changeFilterLocationSelected(location: string): void {
    this.filterLocationSelected = location;
    this.filterPlayers();
  }

  changeFilterTeamSelected(teams: number[]): void {
    this.filterTeamSelected = teams;
    if (teams.length === 0) {
      this.filterTeamAgainstSelected = [];
    }
    this.filterPlayers();
  }

  changeFilterTeamAgainstSelected(ids: number[]): void {
    this.filterTeamAgainstSelected = ids;
    this.filterPlayers();
  }

  resetFilters(): void {
    this.filterPanelChipSelected = 0;
    this.filterLeagueSelected = [];
    this.filterTeamSelected = [];
    this.filterTeamAgainstSelected = [];
    this.filterLocationSelected = '';
    this.filterSeasonSelected = this.seasons[0];
    this.filterPlayers();
  }

  trackByPlayerId(_index: number, player: PlayerViewedStats): number {
    return player.player_id;
  }

  playerRank(player: PlayerViewedStats): number {
    const index = this.players.findIndex((p) => p.player_id === player.player_id);
    return index >= 0 ? index + 1 : 0;
  }
}
