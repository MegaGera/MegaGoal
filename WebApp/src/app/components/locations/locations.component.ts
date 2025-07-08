import { Component } from '@angular/core';
import { FormsModule, FormBuilder, ReactiveFormsModule, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';

import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamShieldF, jamEyeF, jamPlus, jamMinus, jamFilter, jamChevronDown } from '@ng-icons/jam-icons';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { Location } from '../../models/location';
import { RealMatch } from '../../models/realMatch';
import { Match } from '../../models/match';
import { LeaguesSettings } from '../../models/leaguesSettings';
import { shortTeam } from '../../models/team';
import { SeasonInfo } from '../../models/season';
import { MatchParserService } from '../../services/match-parser.service';

@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, NgIconComponent, CommonModule, ScrollingModule],
  templateUrl: './locations.component.html',
  styleUrl: './locations.component.css',
  providers: [provideNgIconsConfig({
    size: '1.5em',
  }), provideIcons({ jamShieldF, jamEyeF, jamPlus, jamMinus, jamFilter, jamChevronDown })]
})
export class LocationsComponent {

  locations: Location[] = [];
  selectedLocation: Location | null = null;
  newLocationForm: any;
  showAddLocationForm = false;
  
  // Left column - Available matches
  availableRealMatches: RealMatch[] = [];
  filteredRealMatches: RealMatch[] = [];
  leagues: LeaguesSettings[] = [];
  teams: shortTeam[] = [];
  filteredTeams: shortTeam[] = [];
  seasons: SeasonInfo[] = [];
  
  // Right column - Viewed matches
  viewedMatches: Match[] = [];
  filteredViewedMatches: Match[] = [];
  
  // Filters
  selectedLeague: LeaguesSettings | null = null;
  selectedTeam_1: shortTeam | null = null;
  selectedTeam_2: shortTeam | null = null;
  selectedSeason: SeasonInfo | null = null;
  
  // Loading states
  loadingAvailableRealMatches = false;
  loadingViewedMatches = false;
  
  // Collapsible states
  showAvailableMatches = true;
  showViewedMatches = true;
  
  constructor(
    private megagoal: MegaGoalService, 
    private formBuilder: FormBuilder,
    private matchParser: MatchParserService,
    private imagesService: ImagesService
  ) {
    this.init();
  }

  init(): void {
    this.newLocationForm = this.formBuilder.group({
      name: ['', Validators.required]
    });
    this.locations = [];
    this.loadViewedMatches();
    this.getLocationsCounts(true);
    this.loadLeagues();
    this.loadTeams();
  }

  getLocationsCounts(refresh: boolean = false) {
    this.megagoal.getLocationsCounts().subscribe(result => {
      this.locations = <Location[]>result;
      this.locations.sort((a, b) => a.matchCount > b.matchCount ? -1 : 1);
      if (this.selectedLocation) {
        this.selectedLocation = this.locations.find(loc => loc.id === this.selectedLocation!.id) || null;
        if (refresh) {
          this.onLocationChange();
        }
      }
    })
  }

  addLocation() {
    if (this.newLocationForm?.valid) {
      this.megagoal.createLocation(this.newLocationForm.value).subscribe(result => {
        this.init();
        this.showAddLocationForm = false;
        this.newLocationForm.reset();
      })
    }
  }

  checkRealMatchesByLocation() {
    if (this.selectedLocation?.venue_id) {
      this.filteredRealMatches = this.availableRealMatches.filter(match => match.fixture.venue.id === this.selectedLocation?.venue_id);
    } else {
      this.filteredRealMatches = [...this.availableRealMatches];
    }
    
    // Limit items for performance (virtual scrolling will handle the rest)
    if (this.filteredRealMatches.length > 1000) {
      this.filteredRealMatches = this.filteredRealMatches.slice(0, 1000);
    }
  }

  onLocationChange() {
    if (this.selectedLocation) {
      this.checkRealMatchesByLocation();
      this.filteredViewedMatches = this.viewedMatches.filter(match => match.location === this.selectedLocation!.id);
    } else {
      this.checkRealMatchesByLocation();
      this.filteredViewedMatches = [...this.viewedMatches];
    }
  }

  loadTeams() {
    this.megagoal.getTeamsByTopLeague().subscribe(teams => {
      this.teams = teams.sort((a, b) => a.name.localeCompare(b.name));
      this.filteredTeams = [...this.teams];
    });
  }

  loadLeagues() {
    this.megagoal.getLeaguesSettings().subscribe(leagues => {
      this.leagues = leagues;
      this.loadSeasons();
    });
  }

  loadSeasons() {
    // Generate seasons from available_seasons in leagues settings
    const seasonSet = new Set<number>();
    this.seasons = [];
    this.leagues.forEach(league => {
      if (league.available_seasons) {
        league.available_seasons.forEach(seasonInfo => {
          // Only include seasons with real_matches and teams greater than 0
          if (seasonInfo.real_matches > 0 && seasonInfo.teams > 0) {
            seasonSet.add(seasonInfo.season);
          }
        });
      }
    });
    
    // Convert Set to Array, create SeasonInfo objects, and sort in descending order (newest first)
    this.seasons = Array.from(seasonSet)
      .sort((a, b) => b - a)
      .map(year => ({
        id: year,
        text: `${year}-${year + 1}`
      }));

    this.selectedSeason = this.seasons[0];
  }

  loadAvailableRealMatches(league_id?: number, season?: number, team_1_id?: number, team_2_id?: number) {    
    this.loadingAvailableRealMatches = true;
    
    // Build parameters object with only defined values
    const parameters: { [key: string]: any } = {};
    
    if (league_id) parameters['league_id'] = league_id;
    if (season) parameters['season'] = season;
    if (team_1_id) parameters['team_id'] = team_1_id;
    if (team_2_id) parameters['team_2_id'] = team_2_id;
    
    // Add finished parameter to get only completed matches
    parameters['finished'] = 'true';
    
    this.megagoal.getRealMatchesByParameters(parameters).subscribe({
      next: (matches: RealMatch[]) => {
        // Sort matches by date (most recent first)
        this.availableRealMatches = matches.sort((a, b) => 
          new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime()
        );
        this.loadingAvailableRealMatches = false;
        this.checkRealMatchesByLocation();
      },
      error: (error: any) => {
        console.error('Error loading available matches:', error);
        this.loadingAvailableRealMatches = false;
      }
    });
  }

  loadViewedMatches() {
    this.loadingViewedMatches = true;
    // Load matches for the selected location
    this.megagoal.getMatches().subscribe(matches => {
      // Sort matches by date (most recent first)
      this.viewedMatches = matches.sort((a, b) => 
        (b.fixture.timestamp * 1000) - (a.fixture.timestamp * 1000)
      );
      this.loadingViewedMatches = false;
      this.filteredViewedMatches = [...this.viewedMatches];
      this.onLocationChange();
    });
  }

  getSelectedFilters() {
    return [
      this.selectedLeague,
      this.selectedSeason,
      this.selectedTeam_1,
      this.selectedTeam_2
    ].filter(filter => filter !== null);
  }

  applyFilters() {
    // Filter teams based on league and season
    this.filterTeamsByLeagueAndSeason();
    
    // Count how many filters are selected
    const selectedFilters = this.getSelectedFilters();
    
    // Call loadAvailableRealMatches if at least 2 filters are selected
    if (selectedFilters.length >= 2) {
      
      this.loadAvailableRealMatches(
        this.selectedLeague?.league_id || undefined,
        this.selectedSeason?.id || undefined,
        this.selectedTeam_1?.id || undefined,
        this.selectedTeam_2?.id || undefined
      );
    } else {
      this.availableRealMatches = [];
      this.loadingAvailableRealMatches = false;
    }
  }

  filterTeamsByLeagueAndSeason() {
    if (!this.selectedLeague || !this.selectedSeason) {
      // If no league or season selected, show all teams
      this.filteredTeams = [...this.teams];
      return;
    }

    // Filter teams based on their seasons array
    this.filteredTeams = this.teams.filter(team => {
      // Check if the team has seasons data
      if (!team.seasons || team.seasons.length === 0) {
        return false;
      }

      // Check if the team has played in the selected league and season
      return team.seasons.some(season => {
        const seasonMatches = season.league === this.selectedLeague!.league_id.toString() && 
                             season.season === this.selectedSeason!.id.toString();
        return seasonMatches;
      });
    });

    // Reset team selections if they're no longer in the filtered list
    if (this.selectedTeam_1 && !this.filteredTeams.find(t => t.id === this.selectedTeam_1!.id)) {
      this.selectedTeam_1 = null;
    }
    if (this.selectedTeam_2 && !this.filteredTeams.find(t => t.id === this.selectedTeam_2!.id)) {
      this.selectedTeam_2 = null;
    }
  }

  addMatchWithLocation(realMatch: RealMatch, locationId: string | number) {
    if (!locationId) return;

    if (this.viewedMatches.find(match => match.fixture.id === realMatch.fixture.id)) {
      this.setLocation(realMatch.fixture.id, locationId);
      return;
    }

    let refresh = true;

    const alreadyLocation = this.locations.find(loc => loc.id === locationId || loc.venue_id === locationId);
    if (alreadyLocation) {
      locationId = alreadyLocation.id;
      refresh = false;
    }

    const matchRequest = this.matchParser.realMatchToMatch(realMatch);
    matchRequest.location = locationId.toString();
    
    this.viewedMatches.push(matchRequest);
    this.viewedMatches = this.viewedMatches.sort((a, b) => 
      (b.fixture.timestamp * 1000) - (a.fixture.timestamp * 1000)
    );
    this.filteredViewedMatches = this.viewedMatches.filter(match => 
      !this.selectedLocation || match.location === this.selectedLocation.id
    );
    
    this.megagoal.createMatch(this.matchParser.matchToMatchRequest(matchRequest)).subscribe(() => {
      if (refresh) {
        this.loadViewedMatches();
      }
      this.getLocationsCounts(refresh);
    });
  }

  deleteMatch(match: Match) {
    this.viewedMatches = this.viewedMatches.filter(m => m.fixture.id !== match.fixture.id);
    this.filteredViewedMatches = this.viewedMatches.filter(match => 
      !this.selectedLocation || match.location === this.selectedLocation.id
    );
    
    this.megagoal.deleteMatch(match.fixture.id).subscribe(() => {
      this.getLocationsCounts(false);
    });
  }

  setLocation(fixtureId: number, location: string | number) {
    const alreadyLocation = this.locations.find(loc => loc.id === location || loc.venue_id === location);
    if (alreadyLocation) {
      location = alreadyLocation.id;
    }
    this.viewedMatches.forEach(match => {
      if (match.fixture.id === fixtureId) {
        match.location = location.toString();
        this.filteredViewedMatches = this.viewedMatches.filter(match => 
          !this.selectedLocation || match.location === this.selectedLocation.id
        );
      }
    });
    
    this.megagoal.setLocation(fixtureId, location.toString()).subscribe(() => {
      this.getLocationsCounts(false);
     });
  }

  clearFilters() {
    this.selectedLeague = null;
    this.selectedTeam_1 = null;
    this.selectedTeam_2 = null;
    this.selectedSeason = this.seasons[0];
    this.filteredTeams = [...this.teams];
    this.applyFilters();
  }

  toggleAvailableMatches() {
    this.showAvailableMatches = !this.showAvailableMatches;
    // Force virtual scroll to recalculate after a short delay
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  }

  toggleViewedMatches() {
    this.showViewedMatches = !this.showViewedMatches;
    // Force virtual scroll to recalculate after a short delay
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  }

  isMatchAlreadyViewed(realMatch: RealMatch): boolean {
    // Check if this real match exists in any viewed matches
    return this.viewedMatches.some(viewedMatch => 
      viewedMatch.fixture.id === realMatch.fixture.id
    );
  }

  isMatchViewedAtSelectedLocation(realMatch: RealMatch): boolean {
    // Check if this real match is viewed at the currently selected location
    if (!this.selectedLocation) return false;

    const match = this.viewedMatches.find(viewedMatch => 
      viewedMatch.fixture.id === realMatch.fixture.id && 
      viewedMatch.location === this.selectedLocation?.id
    );

    return match !== undefined ? true : false;
  }

  isRealMatchViewedAtStadiumLocation(realMatch: RealMatch): boolean {
    // Check if this real match is viewed at any stadium location
    const match = this.viewedMatches.find(viewedMatch => 
      viewedMatch.fixture.id === realMatch.fixture.id
    );

    if (!match) return false;

    // Find the location where this match is viewed
    const location = this.locations.find(loc => loc.id === match.location);
    
    // Return true if the location is a stadium
    return location?.stadium === true;
  }

  isMatchViewedAtStadiumLocation(match: Match): boolean {
    // Find the location where this match is viewed
    const location = this.locations.find(loc => loc.id === match.location);
    
    // Return true if the location is a stadium
    return location?.stadium === true;
  }

  // Helper method to get team image URL
  getTeamImageUrl(teamId: number): string {
    return this.imagesService.getRouteImageTeam(teamId);
  }

  // Helper method to format match result for RealMatch
  getMatchResult(realMatch: RealMatch): string {
    if (realMatch.score && realMatch.score.fulltime && realMatch.score.fulltime.home !== null && realMatch.score.fulltime.away !== null) {
      return `${realMatch.score.fulltime.home} - ${realMatch.score.fulltime.away}`;
    }
    return 'TBD';
  }

  // Helper method to format match result for Match
  getMatchResultFromMatch(match: Match): string {
    if (match.goals && match.goals.home !== null && match.goals.away !== null) {
      return `${match.goals.home} - ${match.goals.away}`;
    }
    return 'TBD';
  }

  // Helper method to get tooltip for real matches
  getMatchLocationTooltip(realMatch: RealMatch): string {
    const match = this.viewedMatches.find(viewedMatch => 
      viewedMatch.fixture.id === realMatch.fixture.id
    );

    if (!match) {
      return '';
    }

    const location = this.locations.find(loc => loc.id === match.location);
    if (location) {
      return `Viewed at: ${location.name}`;
    }

    return `Viewed at: Empty`;
  }

  // Helper method to get tooltip for viewed matches
  getViewedMatchLocationTooltip(match: Match): string {
    const location = this.locations.find(loc => loc.id === match.location);
    if (location) {
      return `Viewed at: ${location.name}`;
    }

    return `Viewed at: Empty`;
  }
}
