import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamChevronLeft, jamChevronRight, jamPlus, jamStarF } from '@ng-icons/jam-icons';
import { forkJoin, of } from 'rxjs';
import { Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { MegaGoalService } from '../../services/megagoal.service';
import { StatsService } from '../../services/stats.service';
import { ImagesService } from '../../services/images.service';
import { MatchParserService } from '../../services/match-parser.service';
import { LeagueColorsService } from '../../services/league-colors.service';
import { RealMatch } from '../../models/realMatch';
import { Match } from '../../models/match';
import { Location } from '../../models/location';
import { League, LeagueStats } from '../../models/league';
import { UserMe } from '../../models/userMe';
import { RealMatchCardComponent } from '../real-match-card/real-match-card.component';
import { FINISHED_STATUSES, isNotStartedStatus } from '../../config/matchStatus';

@Component({
  selector: 'app-matches',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    NgIconComponent,
    RealMatchCardComponent
  ],
  templateUrl: './matches.component.html',
  styleUrl: './matches.component.css',
  providers: [
    provideNgIconsConfig({
      size: '1.2rem',
    }),
    provideIcons({ jamChevronLeft, jamChevronRight, jamPlus, jamStarF })
  ]
})
export class MatchesComponent implements OnInit, OnDestroy {
  isLoading = true;
  selectedDate: string = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD for native input
  // maxDate: string = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
  matches: RealMatch[] = [];
  groupedMatches: { [key: string]: RealMatch[] } = {};
  leagueOrder: string[] = [];
  leagueRows: string[][] = [];
  favouriteGroupedMatches: { [key: string]: RealMatch[] } = {};
  favouriteLeagueOrder: string[] = [];
  favouriteLeagueRows: string[][] = [];
  locations: Location[] = [];
  /** Fixture id → saved location for the selected day (`GET /match?light=true`). */
  private watchedByFixture = new Map<number, string | null>();
  private matchesLoadId = 0;
  private loadedMatchesDate = '';
  
  // Pagination for matches
  matchesPerPage = 9;
  matchesPerPageSmall = 3;
  displayedMatches: { [key: string]: RealMatch[] } = {};
  displayedFavouriteMatches: { [key: string]: RealMatch[] } = {};
  
  // Live matches filter
  showLiveMatches = false;
  
  // Top leagues for ordering
  topLeagues: League[] = [];
  leagueViewCounts: Map<number, number> = new Map();
  /** Watched appearances per club (`GET /teams-viewed/`, all competitions). */
  private teamViewCounts: Map<number, number> = new Map();
  
  // Store original data for live matches toggle
  originalGroupedMatches: { [key: string]: RealMatch[] } = {};
  originalLeagueOrder: string[] = [];
  private userMeSubscription?: Subscription;
  private userMe: UserMe | null = null;
  private favouriteTeamIds: Set<number> = new Set();

  constructor(
    private megaGoalService: MegaGoalService,
    private statsService: StatsService,
    public images: ImagesService,
    private leagueColorsService: LeagueColorsService,
    public matchParser: MatchParserService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.userMeSubscription = this.megaGoalService.userMe$.subscribe((user) => {
      this.userMe = user;
      this.favouriteTeamIds = new Set((user?.favouriteTeams ?? []).map((team) => team.id));
      this.resetToAllMatches();
      if (this.showLiveMatches) {
        this.applyLiveMatchesFilter();
      }
    });
    if (!this.megaGoalService.getUserMeSnapshot()) {
      this.megaGoalService.getUserMe().subscribe({
        error: (error) => console.error('Error loading user profile for favourite teams:', error)
      });
    }

    this.loadLocations();
    this.loadTeamViewCounts();
    this.checkUrlParameters();
    // Load top leagues first, then get matches (to ensure ordering works)
    this.loadTopLeagues(() => {
      this.getMatchesForDate();
    });
  }

  ngOnDestroy(): void {
    this.userMeSubscription?.unsubscribe();
  }

  private checkUrlParameters(): void {
    // Check URL parameters
    this.route.queryParams.subscribe(params => {
      // Check if 'live' parameter is present in URL
      if (params['live'] === 'true') {
        this.showLiveMatches = true;
        // If live matches are requested but no date specified, go to today
        if (!params['date']) {
          this.selectedDate = new Date().toISOString().split('T')[0];
        }
      }
      
      // Check if 'date' parameter is present in URL
      if (params['date']) {
        this.selectedDate = params['date'];
      }
    });
  }

  onDateChange(): void {
    this.updateDateUrlParameter();
    this.getMatchesForDate();
  }

  private updateDateUrlParameter(): void {
    const queryParams: any = { date: this.selectedDate };
    
    // Check if live matches should be active (only for today's date)
    if (this.showLiveMatches && this.isToday()) {
      queryParams.live = 'true';
    } else if (this.showLiveMatches && !this.isToday()) {
      // If live is active but date is not today, deactivate live matches
      this.showLiveMatches = false;
      this.resetToAllMatches();
    }
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams
    });
  }

  goToToday(): void {
    this.selectedDate = new Date().toISOString().split('T')[0];
    this.updateDateUrlParameter();
    this.getMatchesForDate();
  }

  goToPreviousDay(): void {
    const currentDate = new Date(this.selectedDate);
    currentDate.setDate(currentDate.getDate() - 1);
    this.selectedDate = currentDate.toISOString().split('T')[0];
    this.updateDateUrlParameter();
    this.getMatchesForDate();
  }

  goToNextDay(): void {
    const currentDate = new Date(this.selectedDate);
    currentDate.setDate(currentDate.getDate() + 1);
    this.selectedDate = currentDate.toISOString().split('T')[0];
    this.updateDateUrlParameter();
    this.getMatchesForDate();
  }

  isToday(): boolean {
    const today = new Date().toISOString().split('T')[0];
    return this.selectedDate === today;
  }

  toggleLiveMatches(): void {
    this.showLiveMatches = !this.showLiveMatches;
    this.updateUrlParameters();
    this.applyLiveMatchesFilter();
  }

  private updateUrlParameters(): void {
    const queryParams: any = {};
    
    // Add live parameter if active
    if (this.showLiveMatches) {
      queryParams.live = 'true';
    }
    
    // Keep date parameter if it exists
    if (this.selectedDate) {
      queryParams.date = this.selectedDate;
    }
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams
    });
  }

  applyLiveMatchesFilter(): void {
    if (this.showLiveMatches) {
      this.filterLiveMatches();
    } else {
      this.resetToAllMatches();
    }
  }

  filterLiveMatches(): void {
    const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds
    const finishedStatuses = FINISHED_STATUSES as string[];
    
    const liveLeagueOrder: string[] = [];
    const liveGroupedMatches: { [key: string]: RealMatch[] } = {};
    
    this.originalLeagueOrder.forEach(leagueKey => {
      const liveMatches = this.originalGroupedMatches[leagueKey].filter(match => {
        const isNotFinished = !finishedStatuses.includes(match.fixture.status.short);
        const isInPast = match.fixture.timestamp <= now;
        return isNotFinished && isInPast;
      });
      
      // Only include leagues that have live matches
      if (liveMatches.length > 0) {
        liveLeagueOrder.push(leagueKey);
        liveGroupedMatches[leagueKey] = liveMatches;
      }
    });
    
    this.splitMatchesIntoSections(liveGroupedMatches, liveLeagueOrder);
  }

  resetToAllMatches(): void {
    this.splitMatchesIntoSections(this.originalGroupedMatches, this.originalLeagueOrder);
  }

  getMatchesForDate(): void {
    this.isLoading = true;
    const date = this.selectedDate;
    const loadId = ++this.matchesLoadId;
    this.loadedMatchesDate = '';
    this.watchedByFixture = new Map();
    this.loadWatchedMatchRefs(date, loadId);

    this.megaGoalService.getRealMatchesByDate(date, true).subscribe({
      next: (matches: RealMatch[]) => {
        if (loadId !== this.matchesLoadId) {
          return;
        }
        this.matches = matches;
        this.loadedMatchesDate = date;
        this.groupMatchesByLeague();
        
        // Apply live matches filter if URL parameter indicates it should be active
        if (this.showLiveMatches) {
          this.applyLiveMatchesFilter();
        }
        
        this.isLoading = false;
        
        // Log page visit with selected date
        this.megaGoalService.logPageVisit('matches', {
          selectedDate: this.selectedDate,
          showLiveMatches: this.showLiveMatches,
          totalMatches: this.matches.length,
          totalLeagues: this.leagueOrder.length
        }).subscribe({
          next: () => {},
          error: (error) => console.error('Error logging page visit:', error)
        });
      },
      error: (error: any) => {
        if (loadId !== this.matchesLoadId) {
          return;
        }
        console.error('Error fetching matches:', error);
        this.isLoading = false;
      }
    });
  }

  groupMatchesByLeague(): void {
    const groupedMatches: { [key: string]: RealMatch[] } = {};
    const leagueOrder: string[] = [];

    // Group matches by league
    this.matches.forEach(match => {
      const leagueKey = `${match.league.id}_${match.league.season}`;
      
      if (!groupedMatches[leagueKey]) {
        groupedMatches[leagueKey] = [];
        leagueOrder.push(leagueKey);
      }
      
      groupedMatches[leagueKey].push(match);
    });

    // Sort leagues: first by view count (descending), then by position
    leagueOrder.sort((a, b) => {
      const leagueA = groupedMatches[a][0].league;
      const leagueB = groupedMatches[b][0].league;
      
      // Get view counts
      const viewsA = this.leagueViewCounts.get(leagueA.id) || 0;
      const viewsB = this.leagueViewCounts.get(leagueB.id) || 0;
      
      // Find leagues in topLeagues to get their positions
      const topLeagueA = this.topLeagues.find(tl => tl.league.id === leagueA.id);
      const topLeagueB = this.topLeagues.find(tl => tl.league.id === leagueB.id);
      
      // If both have views or both don't have views, compare them
      if ((viewsA > 0 && viewsB > 0) || (viewsA === 0 && viewsB === 0)) {
        if (viewsA > 0 && viewsB > 0) {
          // Both have views - sort by view count descending
          return viewsB - viewsA;
        } else {
          // Neither has views - sort by position
          if (topLeagueA && topLeagueB) {
            const posA = topLeagueA.position || Number.MAX_SAFE_INTEGER;
            const posB = topLeagueB.position || Number.MAX_SAFE_INTEGER;
            return posA - posB;
          }
          
          // If only one league is in topLeagues, put the one not in topLeagues at the end
          if (topLeagueA && !topLeagueB) return -1;
          if (!topLeagueA && topLeagueB) return 1;
          
          // If neither league is in topLeagues, sort alphabetically
          return leagueA.name.localeCompare(leagueB.name);
        }
      }
      
      // One has views and one doesn't - leagues with views come first
      return viewsB - viewsA;
    });

    leagueOrder.forEach(leagueKey => {
      groupedMatches[leagueKey].sort((a, b) => this.compareMatchesInLeague(a, b));
    });
    
    // Store original data for live matches toggle
    this.originalGroupedMatches = groupedMatches;
    this.originalLeagueOrder = leagueOrder;
    this.splitMatchesIntoSections(this.originalGroupedMatches, this.originalLeagueOrder);
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDisplayDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }


  formatTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  }

  isMatchWatched(fixtureId: number): boolean {
    return this.watchedByFixture.has(fixtureId);
  }

  findWatchedMatch(fixtureId: number): Match | undefined {
    if (!this.watchedByFixture.has(fixtureId)) {
      return undefined;
    }
    const location = this.watchedByFixture.get(fixtureId);
    return { _id: '', location: location ?? '' } as Match;
  }

  loadLocations(): void {
    this.megaGoalService.getLocationsCounts().subscribe({
      next: (locations) => {
        this.locations = locations;
      },
      error: (error) => {
        console.error('Error loading locations:', error);
      }
    });
  }

  loadTopLeagues(callback?: () => void): void {
    // Fetch both top leagues and league view stats in parallel
    // If stats fail, continue with empty array so leagues still display
    forkJoin({
      leagues: this.megaGoalService.getTopLeagues(),
      leagueStats: this.statsService.getLeaguesViewed().pipe(
        catchError(error => {
          console.warn('Failed to fetch league stats, continuing without view counts:', error);
          return of([]); // Return empty array if stats fail
        })
      )
    }).subscribe({
      next: (result) => {
        // Create a map of league_id to view count
        this.leagueViewCounts.clear();
        result.leagueStats.forEach((stat: LeagueStats) => {
          this.leagueViewCounts.set(stat.league_id, stat.count);
        });

        this.topLeagues = result.leagues;
        
        // Set CSS variables for league colors
        this.leagueColorsService.setLeagueColors(result.leagues);
        
        // If matches are already loaded, re-group them with the new order
        if (this.matches.length > 0) {
          this.groupMatchesByLeague();
          // Re-apply live filter if active
          if (this.showLiveMatches) {
            this.applyLiveMatchesFilter();
          }
        }
        
        if (callback) {
          callback();
        }
      },
      error: (error) => {
        console.error('Error loading top leagues:', error);
        // Still proceed with matches even if top leagues fail
        if (callback) {
          callback();
        }
      }
    });
  }

  loadTeamViewCounts(): void {
    this.statsService.getTeamsViewed(0, [], 0).subscribe({
      next: (rows) => {
        this.teamViewCounts = new Map(rows.map((row) => [row.team_id, row.count]));
        if (this.loadedMatchesDate && this.matches.length > 0) {
          this.groupMatchesByLeague();
          if (this.showLiveMatches) {
            this.applyLiveMatchesFilter();
          }
        }
      },
      error: (error) => {
        console.error('Error loading team view counts:', error);
      }
    });
  }

  /**
   * Inside a league: clubs the user has watched (or this fixture) first, by combined
   * watch count, with live above the same clubs once they are level. Live matches of
   * unknown clubs come next. Finished matches of unknown clubs stay last.
   */
  private compareMatchesInLeague(a: RealMatch, b: RealMatch): number {
    const bandA = this.matchInterestBand(a);
    const bandB = this.matchInterestBand(b);
    if (bandA !== bandB) {
      return bandB - bandA;
    }
    if (bandA === 2) {
      const interestA = this.matchTeamInterest(a);
      const interestB = this.matchTeamInterest(b);
      if (interestA !== interestB) {
        return interestB - interestA;
      }
    }
    const phaseA = this.matchPhaseRank(a);
    const phaseB = this.matchPhaseRank(b);
    if (phaseA !== phaseB) {
      return phaseA - phaseB;
    }
    return a.fixture.timestamp - b.fixture.timestamp;
  }

  /** 2 known clubs or a fixture the user marked, 1 live unknown, 0 other unknown. */
  private matchInterestBand(match: RealMatch): number {
    if (this.watchedByFixture.has(match.fixture.id) || this.matchTeamInterest(match) > 0) {
      return 2;
    }
    if (this.matchPhaseRank(match) === 0) {
      return 1;
    }
    return 0;
  }

  private matchTeamInterest(match: RealMatch): number {
    return this.teamWatchCount(match.teams?.home?.id) + this.teamWatchCount(match.teams?.away?.id);
  }

  private teamWatchCount(teamId: number | undefined): number {
    if (teamId == null) {
      return 0;
    }
    return this.teamViewCounts.get(teamId) ?? 0;
  }

  /** 0 live, 1 not started, 2 finished. Live matches the page's live filter. */
  private matchPhaseRank(match: RealMatch): number {
    const status = match.fixture?.status?.short;
    if ((FINISHED_STATUSES as readonly string[]).includes(status)) {
      return 2;
    }
    const now = Math.floor(Date.now() / 1000);
    if (!isNotStartedStatus(status) && match.fixture.timestamp <= now) {
      return 0;
    }
    return 1;
  }

  loadWatchedMatchRefs(date: string, loadId: number): void {
    this.megaGoalService.getWatchedMatchRefs(date, date).subscribe({
      next: (refs) => {
        if (loadId !== this.matchesLoadId) {
          return;
        }
        this.watchedByFixture = new Map(refs.map((ref) => [ref.fixture_id, ref.location]));
        if (this.loadedMatchesDate === date && this.matches.length > 0) {
          this.groupMatchesByLeague();
          if (this.showLiveMatches) {
            this.applyLiveMatchesFilter();
          }
        }
      },
      error: (error) => {
        if (loadId !== this.matchesLoadId) {
          return;
        }
        console.error('Error loading watched matches:', error);
      }
    });
  }

  getLeagueLogo(leagueId: number): string {
    return this.images.getRouteImageLeagueSm(leagueId);
  }

  /**
   * Real-match list responses omit league.colors; league-detail uses top-league `colors`.
   * Merge palette from GET /league/top when the match payload has none.
   */
  private resolveLeaguePalette(league: RealMatch['league'] | undefined): League['colors'] | undefined {
    if (!league?.id) {
      return undefined;
    }
    const fromMatch = league.colors;
    const fromMatchRaw =
      fromMatch?.base_color?.trim() ||
      fromMatch?.card_main_color?.trim() ||
      fromMatch?.card_trans_color?.trim();
    if (fromMatchRaw) {
      return fromMatch;
    }
    const top = this.topLeagues.find((tl) => tl.league.id === league.id);
    return top?.colors;
  }

  /** Border / accent color (same fallbacks as league-detail). */
  leagueMarkBorderColor(league: RealMatch['league'] | undefined): string {
    const c = this.resolveLeaguePalette(league);
    const raw =
      c?.base_color?.trim() ||
      c?.card_main_color?.trim() ||
      c?.card_trans_color?.trim();
    if (raw) {
      return raw;
    }
    return '#94a3b8';
  }

  /** Hex from `leagueMarkBorderColor` → rgba for header gradients (league-detail parity). */
  leagueAccentRgba(league: RealMatch['league'] | undefined, alpha: number): string {
    const hex = this.leagueMarkBorderColor(league).replace(/^#/, '').trim();
    let r: number;
    let g: number;
    let b: number;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      r = 148;
      g = 163;
      b = 184;
    }
    if ([r, g, b].some((n) => Number.isNaN(n))) {
      r = 148;
      g = 163;
      b = 184;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  getCountryFlag(league: any): string {
    return league.flag || '';
  }

  getTotalMatches(): number {
    return this.matches.length;
  }

  getTotalLeagues(): number {
    return this.originalLeagueOrder.length;
  }

  // Pagination methods
  getMatchesPerPageForLeague(leagueKey: string, leagueOrderRef: string[]): number {
    const leagueIndex = leagueOrderRef.indexOf(leagueKey);
    // Top 5 leagues (indices 0-4) use matchesPerPage, rest use matchesPerPageSmall
    return leagueIndex < 5 ? this.matchesPerPage : this.matchesPerPageSmall;
  }

  initializeDisplayedMatches(): void {
    this.displayedMatches = {};
    this.displayedFavouriteMatches = {};

    this.favouriteLeagueOrder.forEach(leagueKey => {
      const matchesPerPage = this.getMatchesPerPageForLeague(leagueKey, this.favouriteLeagueOrder);
      this.displayedFavouriteMatches[leagueKey] = this.favouriteGroupedMatches[leagueKey].slice(0, matchesPerPage);
    });

    this.leagueOrder.forEach(leagueKey => {
      const matchesPerPage = this.getMatchesPerPageForLeague(leagueKey, this.leagueOrder);
      this.displayedMatches[leagueKey] = this.groupedMatches[leagueKey].slice(0, matchesPerPage);
    });
  }

  showMoreMatches(leagueKey: string): void {
    const currentCount = this.displayedMatches[leagueKey].length;
    const totalCount = this.groupedMatches[leagueKey].length;
    const matchesPerPage = this.getMatchesPerPageForLeague(leagueKey, this.leagueOrder);
    const nextBatch = Math.min(matchesPerPage, totalCount - currentCount);
    
    if (nextBatch > 0) {
      const startIndex = currentCount;
      const endIndex = startIndex + nextBatch;
      const newMatches = this.groupedMatches[leagueKey].slice(startIndex, endIndex);
      this.displayedMatches[leagueKey].push(...newMatches);
    }
  }

  canShowMoreMatches(leagueKey: string): boolean {
    return this.displayedMatches[leagueKey]?.length < this.groupedMatches[leagueKey]?.length;
  }

  getRemainingMatchesCount(leagueKey: string): number {
    return this.groupedMatches[leagueKey]?.length - (this.displayedMatches[leagueKey]?.length || 0);
  }

  showMoreFavouriteMatches(leagueKey: string): void {
    const currentCount = this.displayedFavouriteMatches[leagueKey].length;
    const totalCount = this.favouriteGroupedMatches[leagueKey].length;
    const matchesPerPage = this.getMatchesPerPageForLeague(leagueKey, this.favouriteLeagueOrder);
    const nextBatch = Math.min(matchesPerPage, totalCount - currentCount);

    if (nextBatch > 0) {
      const startIndex = currentCount;
      const endIndex = startIndex + nextBatch;
      const newMatches = this.favouriteGroupedMatches[leagueKey].slice(startIndex, endIndex);
      this.displayedFavouriteMatches[leagueKey].push(...newMatches);
    }
  }

  canShowMoreFavouriteMatches(leagueKey: string): boolean {
    return this.displayedFavouriteMatches[leagueKey]?.length < this.favouriteGroupedMatches[leagueKey]?.length;
  }

  getRemainingFavouriteMatchesCount(leagueKey: string): number {
    return this.favouriteGroupedMatches[leagueKey]?.length - (this.displayedFavouriteMatches[leagueKey]?.length || 0);
  }

  private splitMatchesIntoSections(sourceGrouped: { [key: string]: RealMatch[] }, sourceOrder: string[]): void {
    this.favouriteGroupedMatches = {};
    this.favouriteLeagueOrder = [];
    this.groupedMatches = {};
    this.leagueOrder = [];

    sourceOrder.forEach((leagueKey) => {
      const matches = sourceGrouped[leagueKey] || [];
      if (matches.length === 0) {
        return;
      }

      const favouriteMatches = matches.filter((match) => this.isFavouriteTeamMatch(match));
      const regularMatches = matches.filter((match) => !this.isFavouriteTeamMatch(match));

      if (favouriteMatches.length > 0) {
        this.favouriteLeagueOrder.push(leagueKey);
        this.favouriteGroupedMatches[leagueKey] = favouriteMatches;
      }

      if (regularMatches.length > 0) {
        this.leagueOrder.push(leagueKey);
        this.groupedMatches[leagueKey] = regularMatches;
      }
    });

    this.favouriteLeagueRows = this.packLeagueRows(this.favouriteLeagueOrder, this.favouriteGroupedMatches);
    this.leagueRows = this.packLeagueRows(this.leagueOrder, this.groupedMatches);
    this.initializeDisplayedMatches();
  }

  /**
   * Desktop rows of 3 match-slots. A league uses 1 slot per match, up to 3.
   * Leagues stay in order; a league that does not fit starts the next row.
   */
  private packLeagueRows(order: string[], grouped: { [key: string]: RealMatch[] }): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let slots = 0;

    order.forEach((leagueKey) => {
      const count = grouped[leagueKey]?.length ?? 0;
      if (count === 0) {
        return;
      }
      const span = this.leagueSlotSpan(count);
      if (slots > 0 && slots + span > 3) {
        rows.push(row);
        row = [];
        slots = 0;
      }
      row.push(leagueKey);
      slots += span;
      if (slots >= 3) {
        rows.push(row);
        row = [];
        slots = 0;
      }
    });

    if (row.length > 0) {
      rows.push(row);
    }
    return rows;
  }

  leagueSlotSpan(count: number): number {
    if (count >= 3) {
      return 3;
    }
    return Math.max(count, 1);
  }

  leagueSpanClass(leagueKey: string, favourite: boolean): string {
    const grouped = favourite ? this.favouriteGroupedMatches : this.groupedMatches;
    return `league-section--span-${this.leagueSlotSpan(grouped[leagueKey]?.length ?? 0)}`;
  }

  trackLeagueRow(row: string[]): string {
    return row.join('|');
  }

  private isFavouriteTeamMatch(match: RealMatch): boolean {
    const homeId = match?.teams?.home?.id;
    const awayId = match?.teams?.away?.id;
    return (homeId != null && this.favouriteTeamIds.has(homeId)) || (awayId != null && this.favouriteTeamIds.has(awayId));
  }

  goToLeague(leagueId: number): void {
    this.router.navigate(['/app/leagues', leagueId]);
  }
} 