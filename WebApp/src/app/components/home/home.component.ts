import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { CommonModule, NgClass, NgOptimizedImage } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select'
import { FormsModule } from '@angular/forms';

import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamFilterF, jamEyeF, jamHomeF } from '@ng-icons/jam-icons';
import { ionFootball } from '@ng-icons/ionicons';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { Match } from '../../models/match';
import { Location } from '../../models/location';
import { SeasonInfo } from '../../models/season';
import { UserStats } from '../../models/userStats';
import { GeneralStats } from '../../models/generalStats';
import { LeagueStats } from '../../models/league';
import { RealMatchCardComponent } from '../real-match-card/real-match-card.component';
import { PaginationComponent } from '../pagination/pagination.component';
import { TeamStatsListComponent } from '../stats/team-stats-list/team-stats-list.component';
import { HeroSectionComponent } from '../hero-section/hero-section.component';
import { StatsService } from '../../services/stats.service';
import { FavouriteTeamCardComponent } from '../stats/favourite-team-card/favourite-team-card.component';
import { FavouriteTeamStats } from '../../models/favouriteTeamStats';
import { GeneralStatsComponent } from '../stats/general-stats/general-stats.component';
import { FiltersHomeComponent } from '../filters-home/filters-home.component';
import { NATIONS_LEAGUE_IDS } from '../../config/topLeagues';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, NgIconComponent, CommonModule, NgOptimizedImage, RealMatchCardComponent, PaginationComponent, MatProgressSpinnerModule, 
    MatExpansionModule, MatChipsModule, MatSelectModule, NgClass, TeamStatsListComponent, HeroSectionComponent, FavouriteTeamCardComponent, GeneralStatsComponent, FiltersHomeComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  providers: [ImagesService, provideNgIconsConfig({
    size: '1.2rem',
  }), provideIcons({ jamFilterF, jamEyeF, jamHomeF, ionFootball })]
})
export class HomeComponent implements OnInit {

  readonly panelOpenState = signal(false);

  /* 
    Array of matches
  */
  matches: Match[] = [];
  matchesOriginal: Match[] = [];
  matchesLoaded: boolean = false;
  matchesPerPage: number = 20;
  matchesFiltered: Match[] = [];
  leaguesViewed: LeagueStats[] = [];
  locations: Location[] = [];
  locationsFiltered: Location[] = [];
  stats: { teamsViewed: any[] } = { teamsViewed: []};
  statsLoaded: boolean = false;
  favouriteTeamStats: FavouriteTeamStats | null = null;
  favouriteTeamLoaded: boolean = false;
  leaguesLoaded: boolean = false;
  
  /* User Stats for Hero Section */
  userStats: UserStats | null = null;
  userStatsLoaded: boolean = false;
  
  /* General Stats */
  generalStats: GeneralStats | null = null;
  generalStatsLoaded: boolean = false;
  
  filterPanelChipSelected: number = 0; // 0 All, 1 Watched, 2 Not Watched
  filterLeagueSelected: number[] = []; // 40: Premier League, 140: La Liga, 141: La Liga 2, 2: Champions League
  filterLocationSelected: string = ''; // Location filter
  filterOrder: 'asc' | 'desc' = 'desc'; // Order: 'asc' for ascending, 'desc' for descending

  /* Seasons */
  seasons: SeasonInfo[] = [{id: 0, text: "All time"}];
  seasonsFiltered: SeasonInfo[] = [];
  filterSeasonSelected!: SeasonInfo;
  
  /* Dynamic Filter Arrays */
  leaguesFiltered: LeagueStats[] = [];

  /* View Mode */
  viewMode: 'stats' | 'matches' | 'filters' = 'matches';

  constructor(private megagoal: MegaGoalService, public images: ImagesService, private changeDetectorRef: ChangeDetectorRef,
    private statsService: StatsService) { }

  setView(mode: 'stats' | 'matches' | 'filters'): void {
    this.viewMode = mode;
  }

  ngOnInit(): void {
    this.getAllMatches();
    this.getLocations();
    this.getUserStats();
    this.getLeaguesStats();
  }

  /* 
    Get all matches from the service
  */
  getAllMatches() {
    this.megagoal.getAllMatches().subscribe(result => {
      this.matchesOriginal = <Match[]>result;
      this.matchesOriginal.sort(function(x, y){
        return y.fixture.timestamp - x.fixture.timestamp;
      })
      this.populateSeasonsFromMatches();
      this.updateFilteredArrays();
      this.changeDetectorRef.detectChanges();
      this.matchesLoaded = true;
      this.filterMatches();
    })
  }

  /*
    Populate seasons array dynamically based on actual seasons in matches
  */
  private populateSeasonsFromMatches() {
    // Get unique seasons from matches
    const uniqueSeasons = [...new Set(this.matchesOriginal.map(match => match.league.season))];
    
    // Sort seasons in descending order (newest first)
    uniqueSeasons.sort((a, b) => b - a);
    
    // Create season objects with proper text formatting
    const seasonObjects: SeasonInfo[] = uniqueSeasons.map(season => ({
      id: season,
      text: `${season}-${season + 1}`
    }));
    
    // Update seasons array with "All time" option first, then the actual seasons
    this.seasons = [
      {id: 0, text: "All time"},
      ...seasonObjects
    ];
    
    // Set the initial selected season to "All time" (first option)
    this.filterSeasonSelected = this.seasons[0];
    
    // Initialize seasonsFiltered with all seasons
    this.seasonsFiltered = [...this.seasons];
  }

  /*
    Update filtered arrays based on current filter selections
  */
  private updateFilteredArrays() {
    // Start with all matches
    let filteredMatches = this.matchesOriginal;

    // Apply chip filter (All/Club/National)
    if (this.filterPanelChipSelected == 1) {
      // Show only club leagues (exclude national leagues)
      filteredMatches = filteredMatches.filter(match => !NATIONS_LEAGUE_IDS.includes(match.league.id));
    } else if (this.filterPanelChipSelected == 2) {
      // Show only national leagues
      filteredMatches = filteredMatches.filter(match => NATIONS_LEAGUE_IDS.includes(match.league.id));
    }

    // For seasons: show all seasons available with current league/location selections (excluding current season filter)
    let seasonsFilteredMatches = this.matchesOriginal;
    if (this.filterPanelChipSelected == 1) {
      seasonsFilteredMatches = seasonsFilteredMatches.filter(match => !NATIONS_LEAGUE_IDS.includes(match.league.id));
    } else if (this.filterPanelChipSelected == 2) {
      seasonsFilteredMatches = seasonsFilteredMatches.filter(match => NATIONS_LEAGUE_IDS.includes(match.league.id));
    }
    
    // Apply league filter for seasons (but not season filter)
    if (this.filterLeagueSelected.length > 0) {
      seasonsFilteredMatches = seasonsFilteredMatches.filter(match => 
        this.filterLeagueSelected.includes(match.league.id)
      );
    }
    
    // Apply location filter for seasons (but not season filter)
    if (this.filterLocationSelected) {
      seasonsFilteredMatches = seasonsFilteredMatches.filter(match => 
        match.location === this.filterLocationSelected
      );
    }
    
    // Update seasons filtered array
    const availableSeasonIds = [...new Set(seasonsFilteredMatches.map(match => match.league.season))];
    this.seasonsFiltered = this.seasons.filter(season => 
      season.id === 0 || availableSeasonIds.includes(season.id)
    );

    // For leagues: show all leagues available with current season/location selections
    let leaguesFilteredMatches = this.matchesOriginal;
    if (this.filterPanelChipSelected == 1) {
      leaguesFilteredMatches = leaguesFilteredMatches.filter(match => !NATIONS_LEAGUE_IDS.includes(match.league.id));
    } else if (this.filterPanelChipSelected == 2) {
      leaguesFilteredMatches = leaguesFilteredMatches.filter(match => NATIONS_LEAGUE_IDS.includes(match.league.id));
    }
    
    // Apply season filter for leagues
    if (this.filterSeasonSelected && this.filterSeasonSelected.id != 0) {
      leaguesFilteredMatches = leaguesFilteredMatches.filter(match => 
        match.league.season == this.filterSeasonSelected.id
      );
    }
    
    // Apply location filter for leagues
    if (this.filterLocationSelected) {
      leaguesFilteredMatches = leaguesFilteredMatches.filter(match => 
        match.location === this.filterLocationSelected
      );
    }
    
    // Update leagues filtered array
    const availableLeagueIds = [...new Set(leaguesFilteredMatches.map(match => match.league.id))];
    this.leaguesFiltered = this.leaguesViewed.filter(league => 
      availableLeagueIds.includes(league.league_id)
    );

    // For locations: show all locations available with current season/league selections
    let locationsFilteredMatches = this.matchesOriginal;
    if (this.filterPanelChipSelected == 1) {
      locationsFilteredMatches = locationsFilteredMatches.filter(match => !NATIONS_LEAGUE_IDS.includes(match.league.id));
    } else if (this.filterPanelChipSelected == 2) {
      locationsFilteredMatches = locationsFilteredMatches.filter(match => NATIONS_LEAGUE_IDS.includes(match.league.id));
    }
    
    // Apply season filter for locations
    if (this.filterSeasonSelected && this.filterSeasonSelected.id != 0) {
      locationsFilteredMatches = locationsFilteredMatches.filter(match => 
        match.league.season == this.filterSeasonSelected.id
      );
    }
    
    // Apply league filter for locations
    if (this.filterLeagueSelected.length > 0) {
      locationsFilteredMatches = locationsFilteredMatches.filter(match => 
        this.filterLeagueSelected.includes(match.league.id)
      );
    }
    
    // Update locations filtered array
    const availableLocationIds = [...new Set(locationsFilteredMatches.map(match => match.location))];
    this.locationsFiltered = this.locations.filter(location => 
      availableLocationIds.includes(location.id)
    );

    // Clean up invalid selections
    this.cleanupInvalidSelections();
  }

  /*
    Remove invalid selections that are no longer available
  */
  private cleanupInvalidSelections() {
    // Clean up invalid league selections
    const availableLeagueIds = this.leaguesFiltered.map(league => league.league_id);
    this.filterLeagueSelected = this.filterLeagueSelected.filter(leagueId => 
      availableLeagueIds.includes(leagueId)
    );

    // Clean up invalid location selection
    const availableLocationIds = this.locationsFiltered.map(location => location.id);
    if (this.filterLocationSelected && !availableLocationIds.includes(this.filterLocationSelected)) {
      this.filterLocationSelected = '';
    }

    // Clean up invalid season selection
    const availableSeasonIds = this.seasonsFiltered.map(season => season.id);
    if (this.filterSeasonSelected && !availableSeasonIds.includes(this.filterSeasonSelected.id)) {
      this.filterSeasonSelected = this.seasonsFiltered[0] || this.seasons[0];
    }
  }

  getLocations() {
    this.megagoal.getLocationsCounts().subscribe(result => {
      this.locations = <Location[]>result;
      this.updateFilteredArrays();
    })
  }

  getStats() {
    this.statsService.getTeamsViewed(this.filterPanelChipSelected, this.filterLeagueSelected, this.filterSeasonSelected.id, this.filterLocationSelected).subscribe(result => {
      this.stats.teamsViewed = result;
      this.statsLoaded = true;
      this.getFavouriteTeamStats();
      this.getGeneralStats();
    })
  }

  getLeaguesStats() {
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
      }
    })
  }


  getUserStats() {
    this.statsService.getUserGeneralStats().subscribe(result => {
      this.userStats = result;
      this.userStatsLoaded = true;
    })
  }

  getFavouriteTeamStats() {
    this.favouriteTeamLoaded = false;
    
    this.statsService.getFavouriteTeamStats(
      this.stats.teamsViewed[0].team_id,
      this.filterLeagueSelected,
      this.filterSeasonSelected.id,
      this.filterLocationSelected
    ).subscribe({
      next: (stats: FavouriteTeamStats) => {
        this.favouriteTeamStats = stats;
        this.favouriteTeamLoaded = true;
      },
      error: (error: any) => {
        console.error('Error fetching favourite team stats:', error);
        this.favouriteTeamLoaded = true;
        this.favouriteTeamStats = null;
      }
    });
  }

  getGeneralStats() {
    this.generalStatsLoaded = false;
    
    this.statsService.getGeneralStats(
      this.filterPanelChipSelected,
      this.filterLeagueSelected,
      this.filterSeasonSelected.id,
      this.filterLocationSelected
    ).subscribe({
      next: (stats: GeneralStats) => {
        this.generalStats = stats;
        this.generalStatsLoaded = true;
      },
      error: (error: any) => {
        console.error('Error fetching general stats:', error);
        this.generalStatsLoaded = true;
        this.generalStats = null;
      }
    });
  }

  filterMatches() {

    // First: Take all the matches
    this.statsLoaded = false;
    this.matches = this.matchesOriginal;

    // Filter by team selection
    if (this.filterPanelChipSelected == 1) {
      // Show only club leagues (exclude national leagues)
      this.matches = this.matches.filter(match => !NATIONS_LEAGUE_IDS.includes(match.league.id));
    } else if (this.filterPanelChipSelected == 2) {
      // Show only national leagues
      this.matches = this.matches.filter(match => NATIONS_LEAGUE_IDS.includes(match.league.id));
    }

    // Filter by league selection
    if (this.filterLeagueSelected.length > 0) {
      this.matches = this.matches.filter(match => this.filterLeagueSelected.includes(match.league.id));
    }

    // Filter by season
    if (this.filterSeasonSelected.id != 0) {
      this.matches = this.matches.filter(match => match.league.season == this.filterSeasonSelected.id);
    }

    // Filter by location
    if (this.filterLocationSelected) {
      this.matches = this.matches.filter(match => match.location === this.filterLocationSelected);
    }

    // Sort by order (create new array to trigger change detection)
    this.matches = [...this.matches].sort((x, y) => {
      if (this.filterOrder === 'desc') {
        return y.fixture.timestamp - x.fixture.timestamp; // Descending (newest first)
      } else {
        return x.fixture.timestamp - y.fixture.timestamp; // Ascending (oldest first)
      }
    });

    this.changeDetectorRef.detectChanges();
    this.matchesLoaded = true;
    this.getStats();
  }

  changeFilterPanelChipSelected(chip: number) {
    this.filterPanelChipSelected = chip;
    this.updateFilteredArrays();
    this.filterMatches();
  }

  changeFilterLeagueSelected(leagues: number[]) {
    this.filterLeagueSelected = leagues;
    this.updateFilteredArrays();
    this.filterMatches();
  }

  changeFilterSeasonSelected(season: SeasonInfo) {
    this.filterSeasonSelected = season;
    this.updateFilteredArrays();
    this.filterMatches();
  }

  changeFilterLocationSelected(location: string) {
    this.filterLocationSelected = location;
    this.updateFilteredArrays();
    this.filterMatches();
  }

  changeFilterOrder(order: 'asc' | 'desc') {
    this.filterOrder = order;
    this.filterMatches();
  }

  resetFilters() {
    this.filterPanelChipSelected = 0; // All
    this.filterLeagueSelected = []; // No leagues selected
    this.filterSeasonSelected = this.seasons[0]; // All time
    this.filterLocationSelected = ''; // All locations
    this.filterOrder = 'desc'; // Reset to descending (newest first)
    this.updateFilteredArrays();
    this.filterMatches();
  }

}
