/* 
  Team component to display information about a team
*/

import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
import { GeneralCardComponent } from '../general-card/general-card.component';
import { FavouriteTeamStats } from '../../models/favouriteTeamStats';
import { TeamHeaderComponent } from './team-header/team-header.component';
import { StatsService } from '../../services/stats.service';
import { provideNgIconsConfig } from '@ng-icons/core';
import { PaginationComponent } from '../pagination/pagination.component';
import { FiltersHomeComponent } from '../filters-home/filters-home.component';
import { LeagueStats } from '../../models/league';

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
    PaginationComponent,
    FiltersHomeComponent,
    GeneralCardComponent,
    MatProgressSpinnerModule,
    TeamHeaderComponent
  ],
  templateUrl: './team.component.html',
  styleUrl: './team.component.css',
  providers: [ImagesService, provideNgIconsConfig({
    size: '1.2rem',
  })]
})
export class TeamComponent {

  /* Seasons */
  seasons: SeasonInfo[] = [];
  selectedSeason!: SeasonInfo;

  leagues: string[] = [];
  selectedLeagues: string[] = [];
  leagueNames: Map<string, string> = new Map();

  /* 
    Selected team shared with Leagues components
  */
  queryTeamId!: number;
  querySeasonId!: number;
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
  insightsSeasonFilter: 'all' | number = 'all';
  personalMatchesPerPage: number = 10;
  personalMatchesPageMatches: Match[] = [];
  filterPanelChipSelected: number = 1;
  filterLocationSelected: string = '';
  leaguesFiltered: LeagueStats[] = [];
  leaguesFilteredLoaded: boolean = false;

  insightsSummary: TeamInsightsSummary = this.resetInsightsSummary();

  seasonBreakdown: Array<{ season: number; matches: number; wins: number; draws: number; losses: number; winRate: number; }> = [];
  seasonBreakdownFiltered: Array<{ season: number; matches: number; wins: number; draws: number; losses: number; winRate: number; }> = [];
  competitionBreakdown: Array<{ leagueId: number; leagueName: string; matches: number; wins: number; winRate: number; }> = [];
  recentForm: Array<{ fixtureId: number; result: 'W' | 'D' | 'L'; opponent: string; score: string; timestamp: number; }> = [];

  constructor(private megagoal: MegaGoalService, private router: Router, public images: ImagesService,
    private statsService: StatsService,
    private Activatedroute: ActivatedRoute, public matchParser: MatchParserService) {
    // Get the selected team of the service. If it is undefined navigate to Leagues component
    // this.team = megagoal.getSelectedTeam();

    this.Activatedroute.queryParamMap.subscribe(params => {
      const newTeamId = +params.get('id')! || 0;
      const newSeasonId = +params.get('season')! || 0;
      
      const teamChanged = this.queryTeamId !== newTeamId;
      const seasonChanged = this.querySeasonId !== newSeasonId;
      
      this.queryTeamId = newTeamId;
      this.querySeasonId = newSeasonId;
      
      if (teamChanged || !this.team) {
        // Team changed or first load - reload everything
        this.init();
      } else if (seasonChanged && this.team) {
        // Only season changed - just update season and reload matches
        if (this.querySeasonId === 0) {
          this.selectedSeason = this.seasons[0]; // Most recent season
        } else {
          this.selectedSeason = this.seasons.find(season => season.id == this.querySeasonId) || this.seasons[0];
        }
        this.getRealMatches();
        this.getMatches();
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
    
    // Set default selected season - if no season provided (querySeasonId is 0), use the most recent season
    if (this.querySeasonId === 0) {
      this.selectedSeason = this.seasons[0]; // Most recent season
    } else {
      this.selectedSeason = this.seasons.find(season => season.id == this.querySeasonId) || this.seasons[0];
    }
  }

  /*
    Get different leagues from the team
  */
  getDifferentLeagues(): string[] {
    // Extract league numbers from the season array of the team
    const leagueIDs: string[] = this.team.seasons.filter(season => +season.season === this.selectedSeason.id)
      .map(season => season.league);

    // Use Set to get unique league numbers
    const uniqueLeagues: Set<string> = new Set(leagueIDs);

    // Convert Set back to array
    this.leagues = Array.from(uniqueLeagues);
    this.selectedLeagues = this.selectedLeagues.filter(league => this.leagues.includes(league));
    if (this.allWatchedMatches.length > 0) {
      this.updateFilteredPersonalMatches();
      this.updateInsightsData();
    }
    return this.leagues;
  }

  /*
    Select Season
  */
  selectSeason(season: SeasonInfo): void {
    // Update URL with new season parameter
    // The queryParamMap subscription will handle updating the data
    this.router.navigate([], {
      relativeTo: this.Activatedroute,
      queryParams: { id: this.queryTeamId, season: season.id },
      queryParamsHandling: 'merge'
    });
  }

  /*
    Select League
  */
  selectLeague(league: string): void {
    if (this.selectedLeagues.includes(league)) {
      this.selectedLeagues = this.selectedLeagues.filter(l => l !== league);
    } else {
      this.selectedLeagues.push(league);
    }
    this.filterMatches();
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
      this.getDifferentLeagues();
      this.filterMatches();
    })
  }

  filterMatches() {
    if (this.selectedLeagues.length === 0) {
      this.showRealMatches = [...this.realMatches];
      return;
    }
    this.showRealMatches = this.realMatches.filter(match => this.selectedLeagues.includes(match.league.id.toString()));
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
    })
  }

  loadAllWatchedMatches(): void {
    this.favouriteTeamLoaded = false;
    this.insightsLoaded = false;
    this.yourMatchesLoaded = false;
    this.megagoal.getMatchesByTeam(this.team.team.id).subscribe({
      next: matches => {
        this.allWatchedMatches = [...matches].sort((a, b) => (b.fixture.timestamp ?? 0) - (a.fixture.timestamp ?? 0));
        this.updateLeaguesFiltered();
        this.updateFilteredPersonalMatches();
        this.yourMatchesLoaded = true;
        this.updateInsightsData();
      },
      error: () => {
        this.allWatchedMatches = [];
        this.filteredPersonalMatches = [];
        this.personalMatchesPageMatches = [];
        this.updateLeaguesFiltered();
        this.yourMatchesLoaded = true;
        this.updateInsightsData();
      }
    });
  }

  setView(mode: 'insights' | 'yourMatches' | 'allMatches'): void {
    this.viewMode = mode;
  }

  get filterLeagueSelectedNumeric(): number[] {
    return this.selectedLeagues
      .map(id => parseInt(id, 10))
      .filter(id => !Number.isNaN(id));
  }

  onFilterPanelChipSelectedChange(chip: number): void {
    this.filterPanelChipSelected = chip;
  }

  onFilterLeagueSelectedChange(leagues: number[]): void {
    this.selectedLeagues = leagues.map(id => id.toString());
    this.filterMatches();
    this.updateFilteredPersonalMatches();
    this.updateInsightsData();
  }

  onFilterSeasonSelectedChange(season: SeasonInfo): void {
    this.selectSeason(season);
  }

  onFilterLocationSelectedChange(location: string): void {
    this.filterLocationSelected = location;
    this.updateFilteredPersonalMatches();
    this.updateInsightsData();
  }

  onInsightsSeasonChange(value: 'all' | number): void {
    this.insightsSeasonFilter = value;
    this.updateInsightsData();
  }

  resetFilters(): void {
    this.filterPanelChipSelected = 1;
    this.filterLocationSelected = '';
    this.selectedLeagues = [];
    this.filterMatches();
    this.updateFilteredPersonalMatches();
    this.updateInsightsData();
    this.updateLeaguesFiltered();
    if (this.seasons.length > 0) {
      this.selectSeason(this.seasons[0]);
    }
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
    const base = this.filteredPersonalMatches.length > 0 || this.filterLocationSelected || this.selectedLeagues.length === 0
      ? this.filteredPersonalMatches
      : this.getFilteredPersonalMatchesBase();

    if (this.insightsSeasonFilter === 'all') {
      return [...base];
    }

    return base.filter(match => match.league.season === this.insightsSeasonFilter);
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

    const leaguesFilter = this.selectedLeagues
      .map(id => Number(id))
      .filter(id => !Number.isNaN(id));

    const seasonFilter = this.insightsSeasonFilter === 'all'
      ? 0
      : this.insightsSeasonFilter;

    this.favouriteTeamLoaded = false;

    this.statsService.getFavouriteTeamStats(
      this.team.team.id,
      leaguesFilter,
      seasonFilter,
      this.filterLocationSelected
    ).subscribe({
      next: (stats: FavouriteTeamStats) => {
        this.favouriteTeamStats = stats;
        this.favouriteTeamLoaded = true;
      },
      error: (error: any) => {
        console.error('Error fetching favourite team stats:', error);
        this.favouriteTeamStats = null;
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
      const matchesLeague = this.selectedLeagues.length === 0 || this.selectedLeagues.includes(match.league.id.toString());
      const matchesLocation = !this.filterLocationSelected || match.location === this.filterLocationSelected;
      return matchesLeague && matchesLocation;
    });

    return matches.sort((a, b) => (b.fixture.timestamp ?? 0) - (a.fixture.timestamp ?? 0));
  }

  private updateLeaguesFiltered(): void {
    if (!this.allWatchedMatches || this.allWatchedMatches.length === 0) {
      this.leaguesFiltered = [];
      this.leaguesFilteredLoaded = true;
      return;
    }

    const leagueCounts = new Map<number, { name: string; count: number }>();
    this.allWatchedMatches.forEach(match => {
      const leagueId = match.league.id;
      const entry = leagueCounts.get(leagueId) || { name: match.league.name, count: 0 };
      entry.count += 1;
      leagueCounts.set(leagueId, entry);
    });

    this.leaguesFiltered = Array.from(leagueCounts.entries())
      .map(([leagueId, data]) => ({
        league_id: leagueId,
        league_name: data.name,
        count: data.count
      }))
      .sort((a, b) => b.count - a.count);

    this.leaguesFilteredLoaded = true;
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

  get insightsReady(): boolean {
    return this.insightsLoaded && this.filteredInsightsMatches.length > 0;
  }

  formatSeason(season: number): string {
    const next = season + 1;
    return `${season}-${next}`;
  }

  trackByCompetition(index: number, item: { leagueId: number }): number {
    return item.leagueId;
  }

  trackBySeason(index: number, item: { season: number }): number {
    return item.season;
  }

}
