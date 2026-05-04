import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { MegaGoalService } from '../../services/megagoal.service';
import { StatsService } from '../../services/stats.service';
import { LeagueColorsService } from '../../services/league-colors.service';
import { League, LeagueStats } from '../../models/league';
import { UserMe } from '../../models/userMe';
import { LeagueCardComponent } from './league-card/league-card.component';

interface CountryOption {
  name: string;
  code: string;
  flag: string;
}

@Component({
  selector: 'app-league-selector',
  standalone: true,
  imports: [FormsModule, LeagueCardComponent],
  templateUrl: './league-selector.component.html',
  styleUrl: './league-selector.component.css'
})
export class LeagueSelectorComponent implements OnDestroy {

  leagues: League[] = [];
  filteredLeagues: League[] = [];
  availableCountries: CountryOption[] = [];
  selectedCountry: string = '';
  leagueViewCounts: Map<number, number> = new Map();
  favouriteLeagueIds: Set<number> = new Set();
  isLoading: boolean = false;
  private userMeSubscription?: Subscription;

  constructor(
    private megagoal: MegaGoalService,
    private stats: StatsService,
    private router: Router,
    private leagueColorsService: LeagueColorsService
  ) {
    this.userMeSubscription = this.megagoal.userMe$.subscribe((user) => {
      this.userMeToFavouriteIds(user);
      this.sortLeagues();
      this.applyCountryFilter();
    });
    if (!this.megagoal.getUserMeSnapshot()) {
      this.megagoal.getUserMe().subscribe({
        error: (error) => console.error('Error loading user profile for favourite leagues:', error)
      });
    } else {
      this.userMeToFavouriteIds(this.megagoal.getUserMeSnapshot());
    }
    this.getLeagues();
  }

  getLeagues(): void {
    this.setLoading(true);
    
    // Fetch both leagues and league view stats in parallel
    // If stats fail, continue with empty array so leagues still display
    forkJoin({
      leagues: this.megagoal.getTopLeagues(),
      leagueStats: this.stats.getLeaguesViewed().pipe(
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

        // Sort leagues: first by view count (descending), then by position
        this.leagues = [...result.leagues];
        this.sortLeagues();
        
        // Extract unique countries for the filter
        this.extractAvailableCountries();
        
        // Initialize filtered leagues
        this.applyCountryFilter();
        
        // Set CSS variables for league colors
        this.leagueColorsService.setLeagueColors(result.leagues);
        
        this.setLoading(false);
        
        // Log page visit
        this.megagoal.logPageVisit('league-selector').subscribe({
          next: () => {},
          error: (error) => console.error('Error logging page visit:', error)
        });
      },
      error: (error: any) => {
        // This will only trigger if the leagues API fails (critical error)
        console.error('Error fetching leagues:', error);
        this.setLoading(false);
      }
    });
  }

  extractAvailableCountries(): void {
    const countryMap = new Map<string, CountryOption>();
    
    this.leagues.forEach(league => {
      const countryName = league.country.name;
      if (!countryMap.has(countryName)) {
        countryMap.set(countryName, {
          name: league.country.name,
          code: league.country.code,
          flag: league.country.flag
        });
      }
    });
    
    // Sort countries alphabetically
    this.availableCountries = Array.from(countryMap.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  }

  onCountryFilterChange(): void {
    this.applyCountryFilter();
  }

  private applyCountryFilter(): void {
    if (!this.selectedCountry) {
      this.filteredLeagues = [...this.leagues];
    } else {
      this.filteredLeagues = this.leagues.filter(league => 
        league.country.name === this.selectedCountry
      );
    }
  }

  getLeagueViewCount(leagueId: number): number | null {
    const count = this.leagueViewCounts.get(leagueId);
    return count && count > 0 ? count : null;
  }

  isLeagueFavourite(leagueId: number): boolean {
    return this.favouriteLeagueIds.has(leagueId);
  }

  selectLeague(league: League): void {
    this.router.navigate(['/app/leagues', league.league.id]);
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  private userMeToFavouriteIds(user: UserMe | null): void {
    this.favouriteLeagueIds = new Set((user?.favouriteLeagues ?? []).map((league) => league.id));
  }

  private sortLeagues(): void {
    this.leagues.sort((a, b) => {
      const isFavouriteA = this.favouriteLeagueIds.has(a.league.id) ? 1 : 0;
      const isFavouriteB = this.favouriteLeagueIds.has(b.league.id) ? 1 : 0;
      if (isFavouriteA !== isFavouriteB) {
        return isFavouriteB - isFavouriteA;
      }

      const viewsA = this.leagueViewCounts.get(a.league.id) || 0;
      const viewsB = this.leagueViewCounts.get(b.league.id) || 0;

      if ((viewsA > 0 && viewsB > 0) || (viewsA === 0 && viewsB === 0)) {
        if (viewsA > 0 && viewsB > 0) {
          return viewsB - viewsA;
        }
        const posA = a.position || Number.MAX_SAFE_INTEGER;
        const posB = b.position || Number.MAX_SAFE_INTEGER;
        return posA - posB;
      }

      return viewsB - viewsA;
    });
  }

  ngOnDestroy(): void {
    this.userMeSubscription?.unsubscribe();
  }
} 