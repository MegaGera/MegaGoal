import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamPlus } from '@ng-icons/jam-icons';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { RealMatchCardComponent } from '../real-match-card/real-match-card.component';
import { MatchParserService } from '../../services/match-parser.service';
import { League } from '../../models/league';
import { SeasonInfo } from '../../models/season';
import { Team } from '../../models/team';
import { RealMatch } from '../../models/realMatch';
import { Match } from '../../models/match';
import { Location } from '../../models/location';

@Component({
  selector: 'app-league-detail',
  standalone: true,
  imports: [
    FormsModule, 
    MatFormFieldModule, 
    MatSelectModule, 
    NgFor, 
    RouterModule,
    RealMatchCardComponent, 
    NgIconComponent
  ],
  templateUrl: './league-detail.component.html',
  styleUrl: './league-detail.component.css',
  providers: [
    ImagesService, 
    provideNgIconsConfig({ size: '2em' }), 
    provideIcons({ jamPlus })
  ]
})
export class LeagueDetailComponent implements OnInit {

  /* League */
  selectedLeague!: League | undefined;
  realMatches: RealMatch[] = [];
  groupedRealMatches: RealMatch[][] = [];
  selectedRound: number = 0;
  matches: Match[] = [];
  locations: Location[] = [];

  /* Seasons */
  seasonsFiltered: SeasonInfo[] = [];
  selectedSeason!: SeasonInfo;

  /* Teams */
  teams: Team[] = [];
  showTeams: Team[] = [];

  /* Matches pagination */
  showMatches: RealMatch[] = [];
  matchesPerPage: number = 50;
  currentMatchesPage: number = 1;

  /* UI State */
  isLoading: boolean = false;

  constructor(
    private megagoal: MegaGoalService, 
    public images: ImagesService, 
    public matchParser: MatchParserService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    // Initialize with empty arrays, will be populated when league is loaded
    this.seasonsFiltered = [];
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const leagueId = +params['id'];
      this.loadLeague(leagueId);
    });

    // Subscribe to query parameters for season and round
    this.route.queryParamMap.subscribe(params => {
      const seasonParam = params.get('season');
      const roundParam = params.get('round');
      const seasonId = seasonParam ? +seasonParam : (this.selectedSeason?.id || 2024);
      const roundIndex = roundParam ? +roundParam : 0;
      
      if (this.selectedLeague) {
        // Update season if different
        if (this.selectedSeason?.id !== seasonId) {
          const newSeason = this.seasonsFiltered.find(season => season.id === seasonId);
          if (newSeason) {
            this.selectedSeason = newSeason;
            this.getTeamsByLeagueAndSeason(this.selectedLeague.league.id, this.selectedSeason.id);
            this.getRealMatches();
            this.getMatches();
          }
        }
        
        // Update round if different and available
        if (this.selectedRound !== roundIndex && this.groupedRealMatches.length > roundIndex) {
          this.selectedRound = roundIndex;
        }
      }
    });
  }

  // This method load the league and the teams by league and season
  loadLeague(leagueId: number): void {
    this.setLoading(true);
    this.megagoal.getTopLeagues().subscribe({
      next: (leagues: League[]) => {
        this.selectedLeague = leagues.find(league => league.league.id === leagueId);
        if (this.selectedLeague) {
          // Generate seasons dynamically from league data
          this.generateSeasonsFromLeague();
          
          // Select the first available season (most recent)
          if (this.seasonsFiltered.length > 0) {
            this.selectedSeason = this.seasonsFiltered[0];
          }
          
          this.getTeamsByLeagueAndSeason(leagueId, this.selectedSeason.id);
          this.getRealMatches();
          this.getMatches();
          this.getLocations();
        } else {
          // League not found, redirect to league selector
          this.router.navigate(['/leagues']);
        }
        this.setLoading(false);
      },
      error: (error: any) => {
        console.error('Error fetching league:', error);
        this.setLoading(false);
        this.router.navigate(['/leagues']);
      }
    });
  }

  /*
    Generate seasons dynamically from league data
  */
  generateSeasonsFromLeague(): void {
    if (!this.selectedLeague || !this.selectedLeague.seasons) {
      this.seasonsFiltered = [];
      return;
    }

    // Convert league seasons to SeasonInfo format and sort by year (descending)
    this.seasonsFiltered = this.selectedLeague.seasons
      .map(season => {
        // Ensure year is a number
        const year = typeof season.year === 'string' ? parseInt(season.year, 10) : season.year;
        return {
          id: year,
          text: `${year}-${year + 1}`
        };
      })
      .sort((a, b) => b.id - a.id); // Sort by year descending (most recent first)
  }

  /*
    Get Real Matches by league_id and season
  */
  getRealMatches() {
    if (this.selectedLeague !== undefined && this.selectedSeason !== undefined) {
      this.setLoading(true);
      this.megagoal.getRealMatchesByLeagueIDAndSeason(this.selectedLeague.league.id, this.selectedSeason.id).subscribe({
        next: (result) => {
          this.realMatches = result;
          this.realMatches.sort(function(x, y){
              return y.fixture.timestamp - x.fixture.timestamp;
          });
          this.groupRealMatches();
          
          // Add default URL parameters after real matches are loaded
          const currentUrl = this.router.url;
          if (!currentUrl.includes('season=') || !currentUrl.includes('round=')) {
            this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { 
                season: this.selectedSeason.id,
                round: this.selectedRound 
              },
              queryParamsHandling: 'merge'
            });
          }
          
          this.setLoading(false);
        },
        error: (error: any) => {
          console.error('Error fetching real matches:', error);
          this.setLoading(false);
        }
      });
    } else {
      this.realMatches = [];
      this.groupedRealMatches = [];
    }
  }

  /*
    This method group Real Matches by round in a matrix to have easy acces to them
  */
  groupRealMatches() {
    // Step 1: Group matches by round using forEach
    const groupedMatches: { [round: string]: RealMatch[] } = {};

    this.realMatches.forEach(match => {
        const round = match.league.round;
        if (!groupedMatches[round]) {
            groupedMatches[round] = [];
        }
        groupedMatches[round].push(match);
    });

    // Step 2: Extract and sort "Regular Season - n" rounds
    const regularSeasonMatches = Object.keys(groupedMatches)
        .filter(round => round.startsWith("Regular Season"))
        .sort((a, b) => {
            const roundA = parseInt(a.split(" - ")[1], 10);
            const roundB = parseInt(b.split(" - ")[1], 10);
            return roundA - roundB;
        })
        .map(round => groupedMatches[round]);

    // Step 3: Extract non-regular season matches
    const otherMatches = Object.keys(groupedMatches)
        .filter(round => !round.startsWith("Regular Season"))
        .map(round => groupedMatches[round]);

    // Step 4: Combine sorted regular season matches with other matches
    this.groupedRealMatches = [...regularSeasonMatches, ...otherMatches];

    // Step 5: Reverse iterate to find the last played round
    for (let i = regularSeasonMatches.length - 1; i >= 0; i--) {
        let matchesInRound = regularSeasonMatches[i];
        if (matchesInRound.some(match => match.fixture.status.short === "FT")) {
            this.selectedRound = i;
            break;
        }
    }

    // Initialize showMatches with first 50 matches of selected round
    if (this.groupedRealMatches.length > 0 && this.selectedRound < this.groupedRealMatches.length) {
        const allMatchesInRound = this.groupedRealMatches[this.selectedRound];
        this.showMatches = allMatchesInRound.slice(0, this.matchesPerPage);
        this.currentMatchesPage = 1;
    } else {
        this.showMatches = [];
        this.currentMatchesPage = 1;
    }
  }

  /*
    This method change the round of the matches by the arrows
  */
  changeRound(n: number) {
    this.getMatches();
    if (this.selectedRound + n >= 0 && this.selectedRound + n < this.groupedRealMatches.length) {
      this.selectedRound = this.selectedRound + n;
      
      // Reset pagination and update showMatches
      this.currentMatchesPage = 1;
      if (this.groupedRealMatches.length > 0 && this.selectedRound < this.groupedRealMatches.length) {
        const allMatchesInRound = this.groupedRealMatches[this.selectedRound];
        this.showMatches = allMatchesInRound.slice(0, this.matchesPerPage);
      } else {
        this.showMatches = [];
      }
      
      // Update URL with new round parameter
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { 
          season: this.selectedSeason.id,
          round: this.selectedRound 
        },
        queryParamsHandling: 'merge'
      });
    }
  }

  /*
    This method handles round selector changes
  */
  onRoundChange(roundIndex: number) {
    this.selectedRound = roundIndex;
    
    // Reset pagination and update showMatches
    this.currentMatchesPage = 1;
    if (this.groupedRealMatches.length > 0 && this.selectedRound < this.groupedRealMatches.length) {
      const allMatchesInRound = this.groupedRealMatches[this.selectedRound];
      this.showMatches = allMatchesInRound.slice(0, this.matchesPerPage);
    } else {
      this.showMatches = [];
    }
    
    // Update URL with new round parameter
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { 
        season: this.selectedSeason.id,
        round: this.selectedRound 
      },
      queryParamsHandling: 'merge'
    });
  }

  /*
    Get Real Matches by team_id and season
  */
  getMatches() {
    this.megagoal.getAllMatches().subscribe({
      next: (result) => {
        this.matches = result;
      },
      error: (error: any) => {
        console.error('Error fetching matches:', error);
      }
    });
  }

  getLocations() {
    this.megagoal.getLocationsCounts().subscribe({
      next: (result: Location[]) => {
        this.locations = result;
      },
      error: (error: any) => {
        console.error('Error fetching locations:', error);
      }
    });
  }

  /*
    This method get teams by season
  */
  getTeamsBySeason(season: SeasonInfo): void {
    this.selectedSeason = season;
    this.getTeamsByLeagueAndSeason(this.selectedLeague!.league.id, season.id);
    this.getRealMatches();
    this.getMatches();
    
    // Reset match pagination
    this.currentMatchesPage = 1;
    
    // Update URL with new season parameter
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { 
        season: season.id,
        round: this.selectedRound 
      },
      queryParamsHandling: 'merge'
    });
  }

  /*
    This method get teams by league and season
  */
  getTeamsByLeagueAndSeason(id: number, season: number): void {
    this.setLoading(true);
    this.megagoal.getTeamsByLeagueAndSeason(id, season).subscribe({
      next: (result: Team[]) => {
        this.teams = result;
        this.showTeams = this.teams.slice(0, 24);
        this.setLoading(false);
      },
      error: (error: any) => {
        console.error('Error fetching teams by league and season:', error);
        this.setLoading(false);
      }
    });
  }

  /*
    This method show all teams
  */
  showAllTeams(): void {
    this.showTeams = this.teams;
  }

  /*
    This method show more matches (50 more)
  */
  showMoreMatches(): void {
    const nextPage = this.currentMatchesPage + 1;
    const startIndex = 0;
    const endIndex = nextPage * this.matchesPerPage;
    
    if (this.groupedRealMatches.length > 0 && this.selectedRound < this.groupedRealMatches.length) {
      const allMatchesInRound = this.groupedRealMatches[this.selectedRound];
      this.showMatches = allMatchesInRound.slice(startIndex, endIndex);
      this.currentMatchesPage = nextPage;
    }
  }

  /*
    Check if there are more matches to show
  */
  hasMoreMatches(): boolean {
    if (this.groupedRealMatches.length === 0 || this.selectedRound >= this.groupedRealMatches.length) {
      return false;
    }
    const allMatchesInRound = this.groupedRealMatches[this.selectedRound];
    return allMatchesInRound.length > this.matchesPerPage && this.showMatches.length < allMatchesInRound.length;
  }

  /*
    This method is called when a team is selected
  */
  selectTeam(team: Team): void {
    // Navigation is handled by routerLink in template
  }

  /*
    Loading state management
  */
  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  /*
    Find real match in matches
  */
  findRealMatchInMatches(fixtureId: number): Match | undefined {
    return this.matches.find(match => match.fixture.id === fixtureId);
  }

  /*
    Navigation method to go back to league selector
  */
  goToLeagueSelector(): void {
    this.router.navigate(['/leagues']);
  }

  /*
    Parse the round name:
     - Regular Season - [N] -> Round - [N]
     - League Stage - [N] -> League R. - [N]
     - Group Stage - [N] -> Group R. - [N]
  */
  parseRoundName(round: string): string {
  // Regular Season - [n] -> Round - [n]
    const regularSeasonRegex = /^Regular Season - (\d+)$/;
    const regularSeasonMatch = round.match(regularSeasonRegex);
    if (regularSeasonMatch) {
      return `Round - ${regularSeasonMatch[1]}`;
    }

    // League Stage - [n] -> League R. - [n]
    const leagueStageRegex = /^League Stage - (\d+)$/;
    const leagueStageMatch = round.match(leagueStageRegex);
    if (leagueStageMatch) {
      return `League R. - ${leagueStageMatch[1]}`;
    }

    // Group Stage - [n] -> Group R. - [n]
    const groupStageRegex = /^Group Stage - (\d+)$/;
    const groupStageMatch = round.match(groupStageRegex);
    if (groupStageMatch) {
      return `Group R. - ${groupStageMatch[1]}`;
    }

    return round;
  }

} 