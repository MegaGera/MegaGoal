/* 
  Team component to display information about a team
*/

import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgClass, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { Team } from '../../models/team';
import { RealMatch } from '../../models/realMatch';

import { RealMatchCardComponent } from '../real-match-card/real-match-card.component';
import { MatchParserService } from '../../services/match-parser.service';
import { SeasonInfo } from '../../models/season';
import { Match } from '../../models/match';
import { isNotStartedStatus } from '../../config/matchStatus';
import { Location } from '../../models/location';
import { FavouriteTeamCardComponent } from '../stats/favourite-team-card/favourite-team-card.component';
import { BasicStatCardComponent } from '../stats/basic-stat-card/basic-stat-card.component';
import { GeneralCardComponent } from '../general-card/general-card.component';
import { TeamCardComponent } from '../team-card/team-card.component';
import { FavouriteTeamStats } from '../../models/favouriteTeamStats';
import { TeamHeaderComponent } from './team-header/team-header.component';
import { StatsService } from '../../services/stats.service';
import { provideNgIconsConfig } from '@ng-icons/core';
import { PaginationComponent } from '../pagination/pagination.component';
import { FiltersHomeComponent } from '../filters-home/filters-home.component';
import { LeagueStats } from '../../models/league';
import { BasicPlayerStatCardComponent } from '../stats/basic-player-stat-card/basic-player-stat-card.component';

interface TeamInsightsSummary {
  totalWatched: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  cleanSheets: number;
  averageGoalsFor: number;
  averageGoalsAgainst: number;
  uniqueSeasons: number;
  uniqueCompetitions: number;
}

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [
    FormsModule, 
    MatFormFieldModule, 
    MatSelectModule, 
    RealMatchCardComponent, 
    NgClass, 
    NgFor,
    FavouriteTeamCardComponent,
    BasicStatCardComponent,
    BasicPlayerStatCardComponent,
    RouterLink,
    PaginationComponent,
    FiltersHomeComponent,
    GeneralCardComponent,
    MatProgressSpinnerModule,
    TeamHeaderComponent,
    TeamCardComponent
  ],
  templateUrl: './team.component.html',
  styleUrl: './team.component.css',
  providers: [
    ImagesService,
    provideNgIconsConfig({
      size: '1.2rem',
    })
  ]
})
export class TeamComponent {

  /* Seasons */
  readonly allTimeSeasonOption: SeasonInfo = { id: 0, text: 'All time' };
  seasons: SeasonInfo[] = [];
  seasonOptions: SeasonInfo[] = [];
  statsSeasonOptions: SeasonInfo[] = [this.allTimeSeasonOption];
  selectedSeason!: SeasonInfo; // Season used for All Matches API calls
  filterSeasonSelected: SeasonInfo = this.allTimeSeasonOption; // Season selected in filters (includes All time)

  leagueNames: Map<string, string> = new Map();

  /* 
    Selected team shared with Leagues components
  */
  queryTeamId!: number;
  team!: Team;
  realMatches: RealMatch[] = [];
  showRealMatches: RealMatch[] = [];
  matches: Match[] = [];
  locations: Location[] = [];

  /* Insights */
  allWatchedMatches: Match[] = [];
  filteredInsightsMatches: Match[] = [];
  filteredPersonalMatches: Match[] = [];
  favouriteTeamStats: FavouriteTeamStats | null = null;
  favouriteTeamLoaded: boolean = false;
  insightsLoaded: boolean = false;
  yourMatchesLoaded: boolean = false;
  viewMode: 'insights' | 'yourMatches' | 'allMatches' = 'insights';
  personalMatchesPerPage: number = 10;
  personalMatchesPageMatches: Match[] = [];
  filterPanelChipSelected: number = 1;
  filterLocationSelected: string = '';
  filterLeagueSelected: number[] = [];
  leaguesStats: LeagueStats[] = [];
  leaguesAllMatches: LeagueStats[] = [];
  leaguesLoaded: boolean = false;
  currentLeagues: LeagueStats[] = [];
  statsLocations: Location[] = [];
  mobileFiltersExpanded: boolean = false;

  insightsSummary: TeamInsightsSummary = this.resetInsightsSummary();

  seasonBreakdown: Array<{ season: number; matches: number; wins: number; draws: number; losses: number; winRate: number; }> = [];
  seasonBreakdownFiltered: Array<{ season: number; matches: number; wins: number; draws: number; losses: number; winRate: number; }> = [];
  competitionBreakdown: Array<{ leagueId: number; leagueName: string; matches: number; wins: number; winRate: number; }> = [];
  recentForm: Array<{ fixtureId: number; result: 'W' | 'D' | 'L'; opponent: string; score: string; timestamp: number; }> = [];
  crazyMatchCard: Match | null = null;
  topGoalscorers: Array<{ player_id: number; player_name: string; goals: number; matches: number; }> = [];
  topAssistProviders: Array<{ player_id: number; player_name: string; assists: number; matches: number; }> = [];
  topWatchedPlayers: Array<{ player_id: number; player_name: string; matches: number; startXI_matches: number; }> = [];
  biggestRival: FavouriteTeamStats['biggest_rival'] | null = null;
  biggestWinMatch: Match | null = null;
  biggestWinGoalDifference: number | null = null;
  topRivalScorer: FavouriteTeamStats['top_rival_scorer'] | null = null;
  mostWatchedRivalPlayer: FavouriteTeamStats['most_watched_rival_player'] | null = null;

  constructor(private megagoal: MegaGoalService, private router: Router, public images: ImagesService,
    private statsService: StatsService,
    private Activatedroute: ActivatedRoute, public matchParser: MatchParserService) {
    // Get the selected team of the service. If it is undefined navigate to Leagues component
    // this.team = megagoal.getSelectedTeam();

    this.Activatedroute.queryParamMap.subscribe(params => {
      const newTeamId = +params.get('id')! || 0;
      
      const teamChanged = this.queryTeamId !== newTeamId;
      
      this.queryTeamId = newTeamId;
      
      if (teamChanged || !this.team) {
        // Team changed or first load - reload everything
        this.init();
      }
    });

  }

  init() {
    this.megagoal.getTeamById(this.queryTeamId).subscribe(result => {
      if (result != undefined) {
        this.team = result;
        this.initializeSeasons();
        this.getRealMatches();
        this.getMatches();
        this.getLocations();
        this.loadAllWatchedMatches();
      } else {
        this.router.navigate(["/app/leagues"]);
      }
    }, error => {
      this.router.navigate(["/app/leagues"]);
    })

  }

  /*
    Initialize seasons dynamically from team's seasons array
  */
  initializeSeasons(): void {
    // Convert team's SeasonTeam[] to SeasonInfo[]
    const uniqueSeasons = new Set<string>();
    
    this.team.seasons.forEach(seasonTeam => {
      uniqueSeasons.add(seasonTeam.season);
    });
    
    this.seasons = Array.from(uniqueSeasons)
      .map(seasonStr => {
        const seasonId = parseInt(seasonStr);
        return {
          id: seasonId,
          text: `${seasonId}-${seasonId + 1}`
        };
      })
      .sort((a, b) => b.id - a.id); // Sort in descending order (newest first)
    
    this.seasonOptions = [this.allTimeSeasonOption, ...this.seasons];
    this.statsSeasonOptions = [this.allTimeSeasonOption];
 
    // Determine selected season for API calls and filters
    this.selectedSeason = this.seasons[0]; // Most recent season
    this.filterSeasonSelected = this.allTimeSeasonOption;
  }

  /*
    Get Real Matches by team_id and season
  */
  getRealMatches() {
    this.megagoal.getRealMatchesByTeamIDAndSeason(this.team.team.id, this.selectedSeason.id).subscribe(result => {
      this.realMatches = result;
      this.realMatches.sort(function (x, y) {
        return y.fixture.timestamp - x.fixture.timestamp;
      })
      // Build league names map from real matches
      this.realMatches.forEach(match => {
        this.leagueNames.set(match.league.id.toString(), match.league.name);
      });
      this.updateLeaguesForAllMatches();
      this.filterMatches();
      this.updateCurrentLeagues();
    })
  }

  filterMatches() {
    if (this.filterLeagueSelected.length === 0) {
      this.showRealMatches = [...this.realMatches];
      return;
    }
    const selectedSet = new Set(this.filterLeagueSelected);
    this.showRealMatches = this.realMatches.filter(match => selectedSet.has(match.league.id));
  }

  /*
    This methods filter Real Matches by status to show them in two columns
  */
  filterStartedRealMatches() {
    return this.showRealMatches.filter(match => !isNotStartedStatus(match.fixture.status.short));
  }
  filterNotStartedRealMatches() {
    return this.showRealMatches.filter(match => isNotStartedStatus(match.fixture.status.short)).sort(function (x, y) {
      return x.fixture.timestamp - y.fixture.timestamp;
    });
  }

  /*
    This methods filter half Real Matches for display in two columns
  */
  filterHalfRealMatches(matches: RealMatch[], col: number) {
    return matches.filter((match, index) => index % 2 === col % 2);
  }

  trackByMatchId(index: number, match: any): number {
    return match.fixture.id; // Ensure each match has a unique identifier
  }

  toggleMobileFilters(): void {
    this.mobileFiltersExpanded = !this.mobileFiltersExpanded;
  }

  /*
    Get Matches by team_id and season
  */
  getMatches() {
    this.megagoal.getMatchesByTeamIDAndSeason(this.team.team.id, this.selectedSeason.id).subscribe(result => {
      this.matches = result;
      this.updateRecentFormFromSeasonMatches();
    })
  }

  findRealMatchInMatches(id: number) {
    return this.matches.find(match => match.fixture.id === id);
  }

  getLocations() {
    this.megagoal.getLocationsCounts().subscribe(result => {
      this.locations = <Location[]>result;
      this.updateStatsLocations();
      const locationChanged = this.ensureFilterLocationValidForStats();
      if (locationChanged && this.viewMode !== 'allMatches') {
        this.updateFilteredPersonalMatches();
        this.updateInsightsData();
        this.updateLeaguesForStats();
      }
    })
  }

  loadAllWatchedMatches(): void {
    this.favouriteTeamLoaded = false;
    this.insightsLoaded = false;
    this.yourMatchesLoaded = false;
    this.megagoal.getMatchesByTeam(this.team.team.id).subscribe({
      next: matches => {
        this.allWatchedMatches = [...matches].sort((a, b) => (b.fixture.timestamp ?? 0) - (a.fixture.timestamp ?? 0));
        this.updateStatsSeasonOptions();
        this.updateLeaguesForStats();
        this.updateFilteredPersonalMatches();
        this.yourMatchesLoaded = true;
        this.updateInsightsData();
      },
      error: () => {
        this.allWatchedMatches = [];
        this.filteredPersonalMatches = [];
        this.personalMatchesPageMatches = [];
        this.updateStatsSeasonOptions();
        this.updateLeaguesForStats();
        this.yourMatchesLoaded = true;
        this.updateInsightsData();
      }
    });
  }

  setView(mode: 'insights' | 'yourMatches' | 'allMatches'): void {
    this.viewMode = mode;

    if (mode !== 'allMatches') {
      const seasonChanged = this.ensureFilterSeasonValidForStats();
      this.updateStatsLocations();
      const locationChanged = this.ensureFilterLocationValidForStats();

      if (seasonChanged || locationChanged) {
        this.updateLeaguesForStats();
        this.updateFilteredPersonalMatches();
        this.updateInsightsData();
      }
    }

    this.updateCurrentLeagues();
  }

  onFilterPanelChipSelectedChange(chip: number): void {
    this.filterPanelChipSelected = chip;
  }

  onFilterLeagueSelectedChange(leagues: number[]): void {
    this.filterLeagueSelected = leagues;
    this.filterMatches();
    this.updateFilteredPersonalMatches();
    this.updateInsightsData();
  }

  onFilterSeasonSelectedChange(season: SeasonInfo): void {
    this.filterSeasonSelected = season;

    const targetSeason = season.id === 0 ? this.seasons[0] : this.seasons.find(item => item.id === season.id) || this.seasons[0];
    this.selectedSeason = targetSeason;

    this.getRealMatches();
    this.getMatches();

    this.updateStatsLocations();
    this.ensureFilterLocationValidForStats();

    this.updateLeaguesForStats();
    this.updateFilteredPersonalMatches();
    this.updateInsightsData();
    this.updateCurrentLeagues();
  }

  onFilterLocationSelectedChange(location: string): void {
    this.filterLocationSelected = location;
    this.updateLeaguesForStats();
    this.updateFilteredPersonalMatches();
    this.updateInsightsData();
  }

  resetFilters(): void {
    this.filterLeagueSelected = [];
    this.filterLocationSelected = '';
    this.filterSeasonSelected = this.allTimeSeasonOption;
    this.selectedSeason = this.seasons[0];

    this.filterPanelChipSelected = 1;

    this.updateStatsLocations();
    this.ensureFilterLocationValidForStats();

    this.updateLeaguesForAllMatches();
    this.updateLeaguesForStats();
    this.filterMatches();
    this.updateFilteredPersonalMatches();
    this.updateInsightsData();
    this.updateCurrentLeagues();
  }

  private updateInsightsData(): void {
    const matches = this.getMatchesForInsights();
    this.filteredInsightsMatches = matches;
    this.insightsSummary = this.buildInsightsSummary(matches);
    this.seasonBreakdown = this.buildSeasonBreakdown(this.filteredPersonalMatches);
    this.seasonBreakdownFiltered = this.buildSeasonBreakdown(matches);
    this.competitionBreakdown = this.buildCompetitionBreakdown(this.filteredPersonalMatches);
    this.recentForm = this.buildRecentForm(matches);
    this.insightsLoaded = true;
    this.fetchFavouriteTeamStats();
  }

  private getMatchesForInsights(): Match[] {
    const base = this.getFilteredPersonalMatchesBase();

    // If "All time" is selected (id: 0), return all matches
    if (this.filterSeasonSelected?.id === 0) {
      return [...base];
    }

    // Otherwise filter by the selected season
    return base.filter(match => match.league.season === this.filterSeasonSelected?.id);
  }

  private buildInsightsSummary(matches: Match[]): TeamInsightsSummary {
    const summary = this.resetInsightsSummary();
    if (matches.length === 0) {
      return summary;
    }

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let cleanSheets = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;

    const competitions = new Set<number>();
    const seasons = new Set<number>();

    matches.forEach(match => {
      const isHome = match.teams.home.id === this.team.team.id;
      const gf = isHome ? match.goals.home : match.goals.away;
      const ga = isHome ? match.goals.away : match.goals.home;
      goalsFor += gf;
      goalsAgainst += ga;
      competitions.add(match.league.id);
      seasons.add(match.league.season);

      if (ga === 0) {
        cleanSheets += 1;
      }

      if (gf > ga) wins += 1;
      else if (gf === ga) draws += 1;
      else losses += 1;
    });

    summary.totalWatched = matches.length;
    summary.wins = wins;
    summary.draws = draws;
    summary.losses = losses;
    summary.winRate = Math.round((wins / matches.length) * 100);
    summary.goalsFor = goalsFor;
    summary.goalsAgainst = goalsAgainst;
    summary.goalDifference = goalsFor - goalsAgainst;
    summary.cleanSheets = cleanSheets;
    summary.averageGoalsFor = parseFloat((goalsFor / matches.length).toFixed(2));
    summary.averageGoalsAgainst = parseFloat((goalsAgainst / matches.length).toFixed(2));
    summary.uniqueSeasons = seasons.size;
    summary.uniqueCompetitions = competitions.size;

    return summary;
  }

  private buildSeasonBreakdown(matches: Match[]): Array<{ season: number; matches: number; wins: number; draws: number; losses: number; winRate: number; }> {
    const seasonMap = new Map<number, { matches: number; wins: number; draws: number; losses: number; }>();

    matches.forEach(match => {
      const season = match.league.season;
      if (!seasonMap.has(season)) {
        seasonMap.set(season, { matches: 0, wins: 0, draws: 0, losses: 0 });
      }
      const entry = seasonMap.get(season)!;
      entry.matches += 1;

      const isHome = match.teams.home.id === this.team.team.id;
      const gf = isHome ? match.goals.home : match.goals.away;
      const ga = isHome ? match.goals.away : match.goals.home;

      if (gf > ga) entry.wins += 1;
      else if (gf === ga) entry.draws += 1;
      else entry.losses += 1;
    });

    return Array.from(seasonMap.entries())
      .map(([season, data]) => ({
        season,
        matches: data.matches,
        wins: data.wins,
        draws: data.draws,
        losses: data.losses,
        winRate: data.matches ? Math.round((data.wins / data.matches) * 100) : 0
      }))
      .sort((a, b) => b.season - a.season);
  }

  private buildCompetitionBreakdown(matches: Match[]): Array<{ leagueId: number; leagueName: string; matches: number; wins: number; winRate: number; }> {
    const competitionMap = new Map<number, { name: string; matches: number; wins: number; }>();

    matches.forEach(match => {
      if (!competitionMap.has(match.league.id)) {
        competitionMap.set(match.league.id, { name: match.league.name, matches: 0, wins: 0 });
      }
      const entry = competitionMap.get(match.league.id)!;
      entry.matches += 1;

      const isHome = match.teams.home.id === this.team.team.id;
      const gf = isHome ? match.goals.home : match.goals.away;
      const ga = isHome ? match.goals.away : match.goals.home;
      if (gf > ga) {
        entry.wins += 1;
      }
    });

    return Array.from(competitionMap.entries())
      .map(([leagueId, data]) => ({
        leagueId,
        leagueName: data.name,
        matches: data.matches,
        wins: data.wins,
        winRate: data.matches ? Math.round((data.wins / data.matches) * 100) : 0
      }))
      .sort((a, b) => b.matches - a.matches);
  }

  private buildRecentForm(matches: Match[]): Array<{ fixtureId: number; result: 'W' | 'D' | 'L'; opponent: string; score: string; timestamp: number; }> {
    return matches.slice(0, 10).map(match => {
      const isHome = match.teams.home.id === this.team.team.id;
      const gf = isHome ? match.goals.home : match.goals.away;
      const ga = isHome ? match.goals.away : match.goals.home;
      let result: 'W' | 'D' | 'L';
      if (gf > ga) result = 'W';
      else if (gf === ga) result = 'D';
      else result = 'L';

      const opponent = isHome ? match.teams.away.name : match.teams.home.name;
      return {
        fixtureId: match.fixture.id,
        result,
        opponent,
        score: `${match.goals.home} - ${match.goals.away}`,
        timestamp: match.fixture.timestamp ?? 0
      };
    });
  }

  private fetchFavouriteTeamStats(): void {
    if (!this.team) {
      return;
    }

    const leaguesFilter = this.filterLeagueSelected;
    const seasonFilter = this.filterSeasonSelected?.id ?? 0; // 0 means "All time"

    this.favouriteTeamLoaded = false;

    this.statsService.getFavouriteTeamStats(
      this.team.team.id,
      leaguesFilter,
      seasonFilter,
      this.filterLocationSelected
    ).subscribe({
      next: (stats: FavouriteTeamStats) => {
        this.favouriteTeamStats = stats;
        this.crazyMatchCard = this.resolveCrazyMatch(stats);
        this.biggestWinMatch = this.resolveBiggestWin(stats);
        this.biggestWinGoalDifference = this.computeGoalDifference(stats.biggest_win ?? null);
        this.topGoalscorers = (stats.goalscorers ?? []).slice(0, 5);
        this.topAssistProviders = (stats.assist_providers ?? []).slice(0, 5);
        this.topWatchedPlayers = (stats.watched_players ?? []).slice(0, 5);
        this.biggestRival = stats.biggest_rival ?? null;
        this.topRivalScorer = stats.top_rival_scorer && stats.top_rival_scorer.player_id
          ? stats.top_rival_scorer
          : null;
        this.mostWatchedRivalPlayer = stats.most_watched_rival_player && stats.most_watched_rival_player.player_id
          ? {
              ...stats.most_watched_rival_player,
              startXI_matches: stats.most_watched_rival_player.startXI_matches ?? 0
            }
          : null;
        this.favouriteTeamLoaded = true;
      },
      error: (error: any) => {
        console.error('Error fetching favourite team stats:', error);
        this.favouriteTeamStats = null;
        this.crazyMatchCard = null;
        this.biggestWinMatch = null;
        this.biggestWinGoalDifference = null;
        this.topGoalscorers = [];
        this.topAssistProviders = [];
        this.topWatchedPlayers = [];
        this.biggestRival = null;
        this.topRivalScorer = null;
        this.mostWatchedRivalPlayer = null;
        this.favouriteTeamLoaded = true;
      }
    });
  }

  private updateRecentFormFromSeasonMatches(): void {
    if (this.viewMode === 'allMatches') {
      // When in matches view we still want to track watch history; insights uses global matches
      this.recentForm = this.buildRecentForm(this.filteredInsightsMatches.length ? this.filteredInsightsMatches : this.allWatchedMatches);
    }
  }

  private updateFilteredPersonalMatches(): void {
    const base = this.getFilteredPersonalMatchesBase();
    this.filteredPersonalMatches = base;
    this.personalMatchesPageMatches = base.slice(0, this.personalMatchesPerPage);
  }

  private getFilteredPersonalMatchesBase(): Match[] {
    const matches = this.allWatchedMatches.filter(match => {
      const matchesLeague = this.filterLeagueSelected.length === 0 || this.filterLeagueSelected.includes(match.league.id);
      const matchesLocation = !this.filterLocationSelected || match.location === this.filterLocationSelected;
      const matchesSeason = !this.filterSeasonSelected || this.filterSeasonSelected.id === 0 || match.league.season === this.filterSeasonSelected.id;
      return matchesLeague && matchesLocation && matchesSeason;
    });

    return matches.sort((a, b) => (b.fixture.timestamp ?? 0) - (a.fixture.timestamp ?? 0));
  }

  private updateLeaguesForStats(): void {
    if (!this.allWatchedMatches || this.allWatchedMatches.length === 0) {
      this.leaguesStats = [];
      if (this.viewMode !== 'allMatches') {
        this.updateCurrentLeagues();
      }
      this.leaguesLoaded = true;
      return;
    }

    const baseMatches = this.allWatchedMatches.filter(match => {
      const matchesLocation = !this.filterLocationSelected || match.location === this.filterLocationSelected;
      const matchesSeason = !this.filterSeasonSelected || this.filterSeasonSelected.id === 0 || match.league.season === this.filterSeasonSelected.id;
      return matchesLocation && matchesSeason;
    });

    const leagueCounts = new Map<number, { name: string; count: number }>();
    baseMatches.forEach(match => {
      const leagueId = match.league.id;
      const entry = leagueCounts.get(leagueId) || { name: match.league.name, count: 0 };
      entry.count += 1;
      leagueCounts.set(leagueId, entry);
    });

    this.leaguesStats = Array.from(leagueCounts.entries())
      .map(([leagueId, data]) => ({
        league_id: leagueId,
        league_name: data.name,
        count: data.count
      }))
      .sort((a, b) => b.count - a.count);

    if (this.viewMode !== 'allMatches') {
      this.updateCurrentLeagues();
    }
    this.leaguesLoaded = true;
  }

  private resolveCrazyMatch(stats: FavouriteTeamStats): Match | null {
    const crazyMatch = stats.crazy_match;
    const fixtureId = crazyMatch?.fixture?.id;
    if (!fixtureId) {
      return null;
    }

    const watchedMatch =
      this.allWatchedMatches.find(match => match.fixture.id === fixtureId) ||
      this.matches.find(match => match.fixture.id === fixtureId);
    if (watchedMatch) {
      return watchedMatch;
    }

    const realMatch = this.realMatches.find(match => match.fixture.id === fixtureId);
    if (realMatch) {
      const storedMatch = this.matches.find(match => match.fixture.id === fixtureId);
      return this.matchParser.realMatchToMatch(realMatch, storedMatch);
    }

    return null;
  }

  private resolveBiggestWin(stats: FavouriteTeamStats): Match | null {
    const biggestWin = stats.biggest_win;
    const fixtureId = biggestWin?.fixture?.id;
    if (!fixtureId) {
      return null;
    }

    const watchedMatch =
      this.allWatchedMatches.find(match => match.fixture.id === fixtureId) ||
      this.matches.find(match => match.fixture.id === fixtureId);
    if (watchedMatch) {
      return watchedMatch;
    }

    const realMatch = this.realMatches.find(match => match.fixture.id === fixtureId);
    if (realMatch) {
      const storedMatch = this.matches.find(match => match.fixture.id === fixtureId);
      return this.matchParser.realMatchToMatch(realMatch, storedMatch);
    }

    return null;
  }

  private computeGoalDifference(matchData: FavouriteTeamStats['biggest_win'] | null): number | null {
    if (!matchData || !matchData.teams || !matchData.goals || !this.team?.team?.id) {
      return null;
    }

    const teamId = this.team.team.id;
    const isHome = matchData.teams.home.id === teamId;
    const teamGoals = isHome ? matchData.goals.home : matchData.goals.away;
    const opponentGoals = isHome ? matchData.goals.away : matchData.goals.home;

    if (typeof teamGoals !== 'number' || typeof opponentGoals !== 'number') {
      return null;
    }

    return teamGoals - opponentGoals;
  }

  calculateCrazyMatchTotalGoals(goals?: { home: number; away: number; } | null): number {
    const home = typeof goals?.home === 'number' ? goals.home : 0;
    const away = typeof goals?.away === 'number' ? goals.away : 0;
    return home + away;
  }

  getPerMatchValue(total?: number | null): number | null {
    if (!this.favouriteTeamStats || this.favouriteTeamStats.matches_watched === 0) {
      return null;
    }
    if (total === undefined || total === null) {
      return null;
    }
    return parseFloat((total / this.favouriteTeamStats.matches_watched).toFixed(2));
  }

  isMatchWatched(fixtureId: number): boolean {
    return this.allWatchedMatches.some(match => match.fixture.id === fixtureId) ||
      this.matches.some(match => match.fixture.id === fixtureId);
  }

  trackByPlayerId(_: number, player: { player_id: number }): number {
    return player.player_id;
  }

  private updateLeaguesForAllMatches(): void {
    if (!this.realMatches || this.realMatches.length === 0) {
      this.leaguesAllMatches = [];
      if (this.viewMode === 'allMatches') {
        this.updateCurrentLeagues();
      }
      this.leaguesLoaded = true;
      return;
    }

    const leagueCounts = new Map<number, { name: string; count: number }>();
    this.realMatches.forEach(match => {
      const leagueId = match.league.id;
      const entry = leagueCounts.get(leagueId) || { name: match.league.name, count: 0 };
      entry.count += 1;
      leagueCounts.set(leagueId, entry);
    });

    this.leaguesAllMatches = Array.from(leagueCounts.entries())
      .map(([leagueId, data]) => ({
        league_id: leagueId,
        league_name: data.name,
        count: data.count
      }))
      .sort((a, b) => b.count - a.count);

    if (this.viewMode === 'allMatches') {
      this.updateCurrentLeagues();
    }
    this.leaguesLoaded = true;
  }

  private updateCurrentLeagues(): void {
    this.currentLeagues = this.viewMode === 'allMatches' ? this.leaguesAllMatches : this.leaguesStats;
    this.leaguesLoaded = true;

    const availableIds = new Set(this.currentLeagues.map(league => league.league_id));
    const filtered = this.filterLeagueSelected.filter(id => availableIds.has(id));

    if (filtered.length !== this.filterLeagueSelected.length) {
      this.filterLeagueSelected = filtered;
      this.filterMatches();
      this.updateFilteredPersonalMatches();
      this.updateInsightsData();
    }
  }

  private updateStatsSeasonOptions(): void {
    const uniqueSeasons = new Set<number>();
    this.allWatchedMatches.forEach(match => {
      const season = match.league?.season;
      if (typeof season === 'number' && !Number.isNaN(season)) {
        uniqueSeasons.add(season);
      }
    });

    const watchedSeasons = Array.from(uniqueSeasons)
      .sort((a, b) => b - a)
      .map(seasonId => this.seasonOptions.find(option => option.id === seasonId) || {
        id: seasonId,
        text: `${seasonId}-${seasonId + 1}`
      });

    this.statsSeasonOptions = [this.allTimeSeasonOption, ...watchedSeasons];

    const seasonChanged = this.ensureFilterSeasonValidForStats();
    this.updateStatsLocations();
    const locationChanged = this.ensureFilterLocationValidForStats();

    if (this.viewMode !== 'allMatches' && (seasonChanged || locationChanged)) {
      this.updateFilteredPersonalMatches();
      this.updateInsightsData();
      this.updateLeaguesForStats();
    }
  }

  private ensureFilterSeasonValidForStats(): boolean {
    const availableOptions = this.statsSeasonOptions.length ? this.statsSeasonOptions : [this.allTimeSeasonOption];

    if (!this.filterSeasonSelected) {
      this.filterSeasonSelected = availableOptions[0];
      return true;
    }

    const match = availableOptions.find(option => option.id === this.filterSeasonSelected.id);

    if (!match) {
      this.filterSeasonSelected = availableOptions[0];
      return true;
    }

    if (this.filterSeasonSelected !== match) {
      this.filterSeasonSelected = match;
    }

    return false;
  }

  private updateStatsLocations(): void {
    if (!this.locations || this.locations.length === 0) {
      this.statsLocations = [];
      return;
    }

    const seasonId = this.filterSeasonSelected?.id ?? 0;
    const matches = seasonId === 0
      ? this.allWatchedMatches
      : this.allWatchedMatches.filter(match => match.league?.season === seasonId);

    const locationIds = new Set<string>();
    matches.forEach(match => {
      const locationId = match.location;
      if (locationId) {
        locationIds.add(locationId);
      }
    });

    const availableLocations: Location[] = this.locations.filter(location => locationIds.has(location.id));

    if (availableLocations.length === locationIds.size) {
      this.statsLocations = availableLocations;
      return;
    }

    const missingLocations = Array.from(locationIds).filter(id => !availableLocations.some(loc => loc.id === id));
    const generatedLocations = missingLocations.map(id => ({
      id,
      name: id,
      user: { username: '' },
      private: false,
      stadium: false,
      official: false,
      matchCount: 0
    } as Location));

    this.statsLocations = [...availableLocations, ...generatedLocations];
  }

  private ensureFilterLocationValidForStats(): boolean {
    if (!this.filterLocationSelected) {
      return false;
    }

    const hasLocation = this.statsLocations.some(location => location.id === this.filterLocationSelected);

    if (!hasLocation) {
      this.filterLocationSelected = '';
      return true;
    }

    return false;
  }

  private resetInsightsSummary(): TeamInsightsSummary {
    return {
      totalWatched: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      winRate: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      cleanSheets: 0,
      averageGoalsFor: 0,
      averageGoalsAgainst: 0,
      uniqueSeasons: 0,
      uniqueCompetitions: 0
    };
  }

  get showFavouriteTeamColumn(): boolean {
    return this.viewMode !== 'allMatches';
  }

  get showFavouriteTeamCard(): boolean {
    if (!this.showFavouriteTeamColumn) {
      return false;
    }

    if (!this.insightsLoaded || !this.yourMatchesLoaded) {
      return true;
    }

    return this.filteredPersonalMatches.length > 0 || this.filteredInsightsMatches.length > 0;
  }

  get insightsReady(): boolean {
    return this.insightsLoaded && this.filteredInsightsMatches.length > 0;
  }

  formatSeason(season: number): string {
    const next = season + 1;
    return `${season}-${next}`;
  }

  formatSeasonShort(season: number): string {
    const next = (season + 1).toString().slice(-2);
    return `${season}-${next}`;
  }

  trackByCompetition(index: number, item: { leagueId: number }): number {
    return item.leagueId;
  }

  trackBySeason(index: number, item: { season: number }): number {
    return item.season;
  }

}
