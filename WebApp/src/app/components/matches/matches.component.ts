import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgIconComponent } from '@ng-icons/core';


import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { MatchParserService } from '../../services/match-parser.service';
import { RealMatch } from '../../models/realMatch';
import { Match } from '../../models/match';
import { Location } from '../../models/location';
import { RealMatchCardComponent } from '../real-match-card/real-match-card.component';

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
  styleUrl: './matches.component.css'
})
export class MatchesComponent implements OnInit {
  isLoading = false;
  selectedDate: string = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD for native input
  maxDate: string = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
  matches: RealMatch[] = [];
  groupedMatches: { [key: string]: RealMatch[] } = {};
  leagueOrder: string[] = [];
  locations: Location[] = [];
  watchedMatches: Match[] = [];
  
  // Pagination for matches
  matchesPerPage = 9;
  displayedMatches: { [key: string]: RealMatch[] } = {};
  
  // Live matches filter
  showLiveMatches = false;

  constructor(
    private megaGoalService: MegaGoalService,
    public images: ImagesService,
    public matchParser: MatchParserService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadLocations();
    this.loadWatchedMatches();
    this.checkUrlParameters();
    this.getMatchesForDate();
  }

  private checkUrlParameters(): void {
    // Check URL parameters
    this.route.queryParams.subscribe(params => {
      // Check if 'live' parameter is present in URL
      if (params['live'] === 'true') {
        this.showLiveMatches = true;
        // Only apply live filter if today's date is selected
        if (this.isToday()) {
          this.applyLiveMatchesFilter();
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
    const finishedStatuses = ["FT", "AET", "PEN", "PST", "CANC"];
    
    // Filter matches that are live (not finished and timestamp is in the past)
    this.leagueOrder.forEach(leagueKey => {
      const liveMatches = this.groupedMatches[leagueKey].filter(match => {
        const isNotFinished = !finishedStatuses.includes(match.fixture.status.short);
        const isInPast = match.fixture.timestamp <= now;
        return isNotFinished && isInPast;
      });
      
      this.displayedMatches[leagueKey] = liveMatches.slice(0, this.matchesPerPage);
    });
  }

  resetToAllMatches(): void {
    this.initializeDisplayedMatches();
  }

  getMatchesForDate(): void {
    this.isLoading = true;
    
    this.megaGoalService.getRealMatchesByDate(this.selectedDate).subscribe({
      next: (matches: RealMatch[]) => {
        this.matches = matches;
        this.groupMatchesByLeague();
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error fetching matches:', error);
        this.isLoading = false;
      }
    });
  }

  groupMatchesByLeague(): void {
    this.groupedMatches = {};
    this.leagueOrder = [];

    this.matches.forEach(match => {
      const leagueKey = `${match.league.id}_${match.league.season}`;
      const leagueName = `${match.league.name} (${match.league.season})`;
      
      if (!this.groupedMatches[leagueKey]) {
        this.groupedMatches[leagueKey] = [];
        this.leagueOrder.push(leagueKey);
      }
      
      this.groupedMatches[leagueKey].push(match);
    });

    // Sort leagues by name, but put Friendlies at the bottom
    this.leagueOrder.sort((a, b) => {
      const leagueA = this.groupedMatches[a][0].league;
      const leagueB = this.groupedMatches[b][0].league;
      
      // Check if leagues are Friendlies (ID 10 or 667)
      const isFriendliesA = leagueA.id === 10 || leagueA.id === 667;
      const isFriendliesB = leagueB.id === 10 || leagueB.id === 667;
      
      // If one is Friendlies and the other isn't, put Friendlies at the bottom
      if (isFriendliesA && !isFriendliesB) return 1;
      if (!isFriendliesA && isFriendliesB) return -1;
      
      // If both are Friendlies or both are not, sort alphabetically
      return leagueA.name.localeCompare(leagueB.name);
    });

    // Sort matches within each league by time
    this.leagueOrder.forEach(leagueKey => {
      this.groupedMatches[leagueKey].sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
    });
    
    // Initialize displayed matches for pagination
    this.initializeDisplayedMatches();
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
    return this.watchedMatches.some(match => match.fixture.id === fixtureId);
  }

  findWatchedMatch(fixtureId: number): Match | undefined {
    return this.watchedMatches.find(match => match.fixture.id === fixtureId);
  }

  loadLocations(): void {
    this.megaGoalService.getLocations().subscribe({
      next: (locations) => {
        this.locations = locations;
      },
      error: (error) => {
        console.error('Error loading locations:', error);
      }
    });
  }

  loadWatchedMatches(): void {
    this.megaGoalService.getMatches().subscribe({
      next: (matches) => {
        this.watchedMatches = matches;
      },
      error: (error) => {
        console.error('Error loading watched matches:', error);
      }
    });
  }

  getLeagueLogo(leagueId: number): string {
    return this.images.getRouteImageLeagueSm(leagueId);
  }

  getCountryFlag(league: any): string {
    return league.flag || '';
  }

  getTotalMatches(): number {
    return this.matches.length;
  }

  getTotalLeagues(): number {
    return this.leagueOrder.length;
  }

  // Pagination methods
  initializeDisplayedMatches(): void {
    this.leagueOrder.forEach(leagueKey => {
      this.displayedMatches[leagueKey] = this.groupedMatches[leagueKey].slice(0, this.matchesPerPage);
    });
  }

  showMoreMatches(leagueKey: string): void {
    const currentCount = this.displayedMatches[leagueKey].length;
    const totalCount = this.groupedMatches[leagueKey].length;
    const nextBatch = Math.min(this.matchesPerPage, totalCount - currentCount);
    
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

  goToLeague(leagueId: number): void {
    this.router.navigate(['/leagues', leagueId]);
  }
} 