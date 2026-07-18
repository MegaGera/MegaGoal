/* 
  Player Info component to display detailed information about a specific player
*/

import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { StatsService } from '../../services/stats.service';
import { Player } from '../../models/player';
import {
  PlayerStats,
  PlayerCareerStats,
  TeamSeasonStats
} from '../../models/playerStats';
import { Team } from '../../models/team';
import { Match } from '../../models/match';
import { MatchRowComponent } from './team-row/match-row/match-row.component';
import { PlayerHeaderComponent } from './player-header/player-header.component';
import { BasicStatCardComponent } from '../stats/basic-stat-card/basic-stat-card.component';
import { GeneralCardComponent } from '../general-card/general-card.component';

@Component({
  selector: 'app-player-info',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatchRowComponent,
    BasicStatCardComponent,
    PlayerHeaderComponent,
    GeneralCardComponent
  ],
  templateUrl: './player-info.component.html',
  styleUrl: './player-info.component.css',
  providers: [ImagesService]
})
export class PlayerInfoComponent implements OnInit {

  queryPlayerId!: number;
  player!: Player;
  playerStats?: PlayerStats;
  playerCareerStats?: PlayerCareerStats;
  loading: boolean = true;
  statsLoading: boolean = true;
  careerStatsLoading: boolean = true;
  
  teamsSeasonsGroups: { season: number; items: { team: any; teamStats?: TeamSeasonStats }[] }[] = [];
  /** Filter for Teams & Seasons: watched-only vs full career history. */
  teamsSeasonsMode: 'watched' | 'all' = 'watched';
  playerAge: number | null = null;
  playerBirthPlace: string | null = null;

  /**
   * Full Team docs for every club that shares the player's latest season year.
   * Kept for a future “last match played” picker; selection uses {@link currentClub} only.
   */
  currentSeasonTeams: Team[] = [];
  /** Preferred club for the header (non-national if possible, else first). */
  currentClub: Team | null = null;

  isMobileView = false;
  mobileSection: 'stats' | 'teams' = 'stats';

  readonly skeletonStatSlots = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  readonly skeletonTeamSlots = [1, 2, 3, 4];

  readonly teamsStatsLegend = [
    { icon: '🏟️', label: 'Matches played', key: 'matches_played' as const },
    { icon: '👁️', label: 'Matches watched', key: 'matches_viewed' as const },
    { icon: '⚽', label: 'Goals', key: 'goals' as const },
    { icon: '🎯', label: 'Assists', key: 'assists' as const },
    { icon: '🟨', label: 'Yellow cards', key: 'yellow_cards' as const },
    { icon: '🟥', label: 'Red cards', key: 'red_cards' as const }
  ] as const;

  /** Columns for the current mode: no played count in Only watched. */
  get visibleTeamsStatsLegend() {
    return this.teamsStatsLegend.filter((entry) => {
      if (this.teamsSeasonsMode === 'watched' && entry.key === 'matches_played') {
        return false;
      }
      return true;
    });
  }

  private expandedTeamMatches = new Set<string>();
  /** Lazy-loaded career match lists keyed by `${season}:${teamId}`. */
  private careerMatchesCache = new Map<string, Match[]>();
  private careerMatchesLoadingKeys = new Set<string>();

  constructor(
    private megagoal: MegaGoalService, 
    private router: Router, 
    private activatedRoute: ActivatedRoute,
    private statsService: StatsService,
    public images: ImagesService
  ) {
    this.updateIsMobileView();
    this.activatedRoute.queryParamMap.subscribe(params => {
      this.queryPlayerId = +params.get('id')! || 0;
      this.init();
    });
  }

  ngOnInit(): void {
    this.updateIsMobileView();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateIsMobileView();
  }

  private updateIsMobileView(): void {
    this.isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
  }

  get showPlayerMobileTabs(): boolean {
    return this.isMobileView && (this.hasStatsSection || this.hasTeams() || this.statsLoading);
  }

  get hasStatsSection(): boolean {
    return !this.statsLoading && !!this.playerStats;
  }

  setMobileSection(section: 'stats' | 'teams'): void {
    this.mobileSection = section;
  }

  init() {
    this.loading = true;
    this.statsLoading = true;
    this.careerStatsLoading = true;
    this.currentSeasonTeams = [];
    this.currentClub = null;
    this.mobileSection = 'stats';
    this.playerStats = undefined;
    this.playerCareerStats = undefined;
    this.teamsSeasonsGroups = [];
    this.teamsSeasonsMode = 'watched';
    this.expandedTeamMatches.clear();
    this.careerMatchesCache.clear();
    this.careerMatchesLoadingKeys.clear();
    
    this.megagoal.getPlayerById(this.queryPlayerId).subscribe(result => {
      if (result != undefined) {
        this.player = result;
        this.playerAge = this.calculatePlayerAge(this.player.player?.birth?.date);
        this.playerBirthPlace = this.buildBirthPlace(this.player.player?.birth);
        this.loading = false;
        this.loadPlayerStats();
        this.loadPlayerCareerStats();
        this.loadCurrentSeasonTeams();
        this.syncMobileSection();
        
        // Log page visit with player information
        this.megagoal.logPageVisit('player-info', {
          playerId: this.player.player.id,
          playerName: this.player.player.name
        }).subscribe({
          next: () => {},
          error: (error) => console.error('Error logging page visit:', error)
        });
      } else {
        this.router.navigate(["/app/home"]);
      }
    }, error => {
      console.error('Error loading player:', error);
      this.router.navigate(["/app/home"]);
    });
  }

  loadPlayerStats() {
    this.statsService.getPlayerStats(this.queryPlayerId).subscribe(result => {
      this.playerStats = result;
      this.statsLoading = false;
      this.updateTeamsSeasonsList();
      this.syncMobileSection();
    }, error => {
      console.error('Error loading player stats:', error);
      this.statsLoading = false;
      this.updateTeamsSeasonsList();
      this.syncMobileSection();
    });
  }

  loadPlayerCareerStats() {
    this.statsService.getPlayerCareerStats(this.queryPlayerId).subscribe({
      next: (result) => {
        this.playerCareerStats = result;
        this.careerStatsLoading = false;
        this.updateTeamsSeasonsList();
        this.syncMobileSection();
      },
      error: (error) => {
        console.error('Error loading player career stats:', error);
        this.playerCareerStats = undefined;
        this.careerStatsLoading = false;
        this.updateTeamsSeasonsList();
        this.syncMobileSection();
      }
    });
  }

  private syncMobileSection(): void {
    if (this.mobileSection === 'stats' && !this.hasStatsSection && this.hasTeams()) {
      this.mobileSection = 'teams';
      return;
    }
    if (this.mobileSection === 'teams' && !this.hasTeams() && this.hasStatsSection) {
      this.mobileSection = 'stats';
    }
  }

  /**
   * Teams whose seasons include the max year on the player doc; fetch full Team payloads.
   */
  private loadCurrentSeasonTeams(): void {
    this.currentSeasonTeams = [];
    this.currentClub = null;

    const history = this.player?.teams;
    if (!Array.isArray(history) || history.length === 0) {
      return;
    }

    let maxSeason = -Infinity;
    for (const entry of history) {
      for (const season of entry.seasons ?? []) {
        const y = Number(season);
        if (!Number.isNaN(y)) {
          maxSeason = Math.max(maxSeason, y);
        }
      }
    }
    if (maxSeason === -Infinity) {
      return;
    }

    const candidateIds = history
      .filter((entry) =>
        (entry.seasons ?? []).some((s: number) => Number(s) === maxSeason)
      )
      .map((entry) => entry.team.id as number)
      .filter((id, index, arr) => id != null && arr.indexOf(id) === index);

    if (candidateIds.length === 0) {
      return;
    }

    forkJoin(
      candidateIds.map((id) =>
        this.megagoal.getTeamById(id).pipe(
          catchError((err) => {
            console.error(`Error fetching team ${id} for player header:`, err);
            return of(null);
          })
        )
      )
    ).subscribe((results) => {
      const teams = results.filter((t): t is Team => t != null && t.team?.id != null);
      this.currentSeasonTeams = teams;
      this.currentClub = this.pickCurrentClub(teams);
    });
  }

  /** Prefer a club side over a national team; otherwise first entry. */
  private pickCurrentClub(teams: Team[]): Team | null {
    if (teams.length === 0) {
      return null;
    }
    const clubSide = teams.find((t) => t.team?.national === false);
    return clubSide ?? teams[0];
  }
  
  setTeamsSeasonsMode(mode: 'watched' | 'all'): void {
    if (this.teamsSeasonsMode === mode) {
      return;
    }
    this.teamsSeasonsMode = mode;
    this.expandedTeamMatches.clear();
    this.updateTeamsSeasonsList();
  }

  updateTeamsSeasonsList(): void {
    this.teamsSeasonsGroups =
      this.teamsSeasonsMode === 'watched'
        ? this.buildWatchedTeamsSeasonsGroups()
        : this.buildAllPlayedTeamsSeasonsGroups();
  }

  private buildWatchedTeamsSeasonsGroups(): {
    season: number;
    items: { team: any; teamStats?: TeamSeasonStats }[];
  }[] {
    if (!this.playerStats?.seasons?.length) {
      return [];
    }

    const groups: { season: number; items: { team: any; teamStats?: TeamSeasonStats }[] }[] = [];
    const seasonsSorted = [...this.playerStats.seasons].sort((a, b) => b.season - a.season);

    for (const seasonData of seasonsSorted) {
      const items = (seasonData.teams ?? [])
        .filter(
          (teamStats) =>
            (teamStats.matches_viewed ?? 0) > 0 || (teamStats.matches?.length ?? 0) > 0
        )
        .map((teamStats) => {
          const career = this.findCareerTeamSeasonStats(teamStats.team_id, seasonData.season);
          return {
            team: this.resolveTeamData(teamStats.team_id, teamStats.team_name),
            teamStats: {
              ...teamStats,
              matches_played: career?.matches_played ?? teamStats.matches_played ?? 0
            }
          };
        });

      if (items.length > 0) {
        groups.push({ season: seasonData.season, items });
      }
    }

    return groups;
  }

  private buildAllPlayedTeamsSeasonsGroups(): {
    season: number;
    items: { team: any; teamStats?: TeamSeasonStats }[];
  }[] {
    if (this.playerCareerStats?.seasons?.length) {
      return [...this.playerCareerStats.seasons]
        .sort((a, b) => b.season - a.season)
        .map((seasonData) => ({
          season: seasonData.season,
          items: (seasonData.teams ?? []).map((careerTeam) => ({
            team: this.resolveTeamData(careerTeam.team_id, careerTeam.team_name),
            teamStats: {
              team_id: careerTeam.team_id,
              team_name: careerTeam.team_name,
              matches: [],
              matches_played: careerTeam.matches_played,
              matches_viewed: careerTeam.matches_viewed,
              goals: careerTeam.goals,
              assists: careerTeam.assists,
              yellow_cards: careerTeam.yellow_cards,
              red_cards: careerTeam.red_cards
            }
          }))
        }))
        .filter((group) => group.items.length > 0);
    }

    // Fallback while career is loading / unavailable: career clubs with zeros + watched overlays.
    const career = this.player?.teams;
    if (Array.isArray(career) && career.length > 0) {
      const bySeason = new Map<number, { team: any; teamStats?: TeamSeasonStats }[]>();

      for (const entry of career) {
        const teamId = entry?.team?.id;
        if (teamId == null) {
          continue;
        }
        for (const season of entry.seasons ?? []) {
          const year = Number(season);
          if (Number.isNaN(year)) {
            continue;
          }
          const watched = this.findWatchedTeamSeasonStats(teamId, year);
          const list = bySeason.get(year) ?? [];
          list.push({
            team: entry,
            teamStats: {
              team_id: teamId,
              team_name: entry.team?.name ?? `Team ${teamId}`,
              matches: [],
              matches_played: 0,
              matches_viewed: watched?.matches_viewed ?? 0,
              goals: watched?.goals ?? 0,
              assists: watched?.assists ?? 0,
              yellow_cards: watched?.yellow_cards ?? 0,
              red_cards: watched?.red_cards ?? 0
            }
          });
          bySeason.set(year, list);
        }
      }

      return [...bySeason.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([season, items]) => ({ season, items }));
    }

    return [];
  }

  private findWatchedTeamSeasonStats(teamId: number, season: number): TeamSeasonStats | undefined {
    const seasonData = this.playerStats?.seasons?.find((s) => s.season === season);
    return seasonData?.teams?.find((t) => t.team_id === teamId);
  }

  private findCareerTeamSeasonStats(teamId: number, season: number) {
    const seasonData = this.playerCareerStats?.seasons?.find((s) => s.season === season);
    return seasonData?.teams?.find((t) => t.team_id === teamId);
  }

  /** Prefer career team doc (logo/country); fall back to stats name/id. */
  private resolveTeamData(teamId: number, teamName: string): any {
    const fromCareer = this.player?.teams?.find((entry: any) => entry?.team?.id === teamId);
    if (fromCareer) {
      return fromCareer;
    }
    return { team: { id: teamId, name: teamName } };
  }

  formatSeasonDisplay(season: number): string {
    return `${season}/${(season + 1).toString().slice(-2)}`;
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  private calculatePlayerAge(birthDateString?: string | null): number | null {
    if (!birthDateString) return null;

    const birthDate = new Date(birthDateString);
    if (isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();

    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age >= 0 ? age : null;
  }

  private buildBirthPlace(birth?: { place?: string | null; country?: string | null } | null): string | null {
    if (!birth) return null;

    const parts = [birth.place, birth.country].filter((value): value is string => !!value?.trim());
    return parts.length ? parts.join(', ') : null;
  }

  hasTeams(): boolean {
    return this.hasCareerTeams() || this.hasAnyWatchedTeamSeason() || this.hasCareerStatsTeams();
  }

  hasCareerTeams(): boolean {
    return Array.isArray(this.player?.teams) && this.player.teams.length > 0;
  }

  private hasCareerStatsTeams(): boolean {
    return (this.playerCareerStats?.seasons ?? []).some((s) => (s.teams?.length ?? 0) > 0);
  }

  private hasAnyWatchedTeamSeason(): boolean {
    return (this.playerStats?.seasons ?? []).some((season) =>
      (season.teams ?? []).some(
        (team) => (team.matches_viewed ?? 0) > 0 || (team.matches?.length ?? 0) > 0
      )
    );
  }

  teamStatValue(
    stats: TeamSeasonStats | undefined,
    key: 'matches_played' | 'matches_viewed' | 'goals' | 'assists' | 'yellow_cards' | 'red_cards'
  ): number {
    const value = stats?.[key];
    return typeof value === 'number' ? value : 0;
  }

  hasExpandableMatches(stats: TeamSeasonStats | undefined): boolean {
    if (this.teamsSeasonsMode === 'all') {
      return (stats?.matches_played ?? 0) > 0;
    }
    return (stats?.matches?.length ?? 0) > 0;
  }

  isTeamMatchesExpanded(season: number, teamId: number): boolean {
    return this.expandedTeamMatches.has(this.teamMatchesKey(season, teamId));
  }

  isCareerMatchesLoading(season: number, teamId: number): boolean {
    return this.careerMatchesLoadingKeys.has(this.teamMatchesKey(season, teamId));
  }

  toggleTeamMatches(season: number, teamId: number): void {
    const key = this.teamMatchesKey(season, teamId);
    if (this.expandedTeamMatches.has(key)) {
      this.expandedTeamMatches.delete(key);
      return;
    }

    if (this.teamsSeasonsMode === 'watched') {
      this.expandedTeamMatches.add(key);
      return;
    }

    // All played: lazy-load match list
    if (this.careerMatchesCache.has(key)) {
      this.expandedTeamMatches.add(key);
      return;
    }

    this.careerMatchesLoadingKeys.add(key);
    this.expandedTeamMatches.add(key);
    this.statsService.getPlayerTeamSeasonMatches(this.queryPlayerId, teamId, season).subscribe({
      next: (result) => {
        this.careerMatchesCache.set(key, result.matches ?? []);
        this.careerMatchesLoadingKeys.delete(key);
      },
      error: (error) => {
        console.error('Error loading team season matches:', error);
        this.careerMatchesCache.set(key, []);
        this.careerMatchesLoadingKeys.delete(key);
      }
    });
  }

  getExpandedMatches(season: number, teamId: number, stats?: TeamSeasonStats): Match[] {
    if (this.teamsSeasonsMode === 'all') {
      const cached = this.careerMatchesCache.get(this.teamMatchesKey(season, teamId));
      return cached ? this.sortMatches(cached) : [];
    }
    return this.sortMatches(stats?.matches ?? []);
  }

  private sortMatches(matches: Match[]): Match[] {
    return [...matches].sort(
      (a, b) => (b.fixture?.timestamp || 0) - (a.fixture?.timestamp || 0)
    );
  }

  onTeamImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = 'assets/img/default-player.png';
    }
  }

  private teamMatchesKey(season: number, teamId: number): string {
    return `${season}:${teamId}`;
  }
  
}
