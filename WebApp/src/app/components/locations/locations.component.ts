import { Component } from '@angular/core';
import { FormsModule, FormBuilder, ReactiveFormsModule, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamShieldF, jamEyeF, jamPlus, jamMinus, jamFilter } from '@ng-icons/jam-icons';

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
  imports: [FormsModule, ReactiveFormsModule, NgIconComponent, CommonModule],
  templateUrl: './locations.component.html',
  styleUrl: './locations.component.css',
  providers: [provideNgIconsConfig({
    size: '1.5em',
  }), provideIcons({ jamShieldF, jamEyeF, jamPlus, jamMinus, jamFilter })]
})
export class LocationsComponent {

  locations: Location[] = [];
  selectedLocation: Location | null = null;
  newLocationForm: any;
  showAddLocationForm = false;
  
  // Middle column - Available matches
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
    this.getLocationsCounts();
    this.loadLeagues();
    this.loadTeams();
    this.loadViewedMatches();
  }

  getLocationsCounts() {
    this.megagoal.getLocationsCounts().subscribe(result => {
      this.locations = <Location[]>result;
      this.locations.sort((a, b) => a.matchCount > b.matchCount ? -1 : 1);
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
      console.log('Filtering real matches by venue id:', this.selectedLocation?.venue_id);
      this.filteredRealMatches = this.availableRealMatches.filter(match => match.fixture.venue.id === this.selectedLocation?.venue_id);
    } else {
      this.filteredRealMatches = [...this.availableRealMatches];
    }
  }

  onLocationChange() {
    if (this.selectedLocation) {
      this.checkRealMatchesByLocation();
      this.filteredViewedMatches = this.viewedMatches.filter(match => match.location === this.selectedLocation!.id);
    } else {
      this.filteredViewedMatches = [...this.viewedMatches];
    }
  }

  loadTeams() {
    this.megagoal.getTeamsByTopLeague().subscribe(teams => {
      this.teams = teams.sort((a, b) => a.name.localeCompare(b.name));
      this.filteredTeams = [...this.teams];
      // console.log(this.teams);
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
    
    // console.log('Calling API with parameters:', parameters);
    
    this.megagoal.getRealMatchesByParameters(parameters).subscribe({
      next: (matches: RealMatch[]) => {
        // Sort matches by date (most recent first)
        this.availableRealMatches = matches.sort((a, b) => 
          new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime()
        );
        this.loadingAvailableRealMatches = false;
        // console.log(`Loaded ${matches.length} matches`);
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
      this.filteredViewedMatches = [...this.viewedMatches];
      this.loadingViewedMatches = false;
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
      // console.log('Selected filters:', selectedFilters.length);
      // console.log('League:', this.selectedLeague?.league_id);
      // console.log('Season:', this.selectedSeason?.id);
      // console.log('Team 1:', this.selectedTeam_1?.id);
      // console.log('Team 2:', this.selectedTeam_2?.id);
      
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

  addMatchToLocation(realMatch: RealMatch) {
    if (!this.selectedLocation) return;
    
    const matchRequest = this.matchParser.realMatchToMatch(realMatch);
    matchRequest.location = this.selectedLocation.name;
    
    this.megagoal.createMatch(matchRequest).subscribe(() => {
      // Remove from available matches
      this.availableRealMatches = this.availableRealMatches.filter(m => m.fixture.id !== realMatch.fixture.id);
      this.applyFilters();
      
      // Add to viewed matches
      const newMatch = this.matchParser.realMatchToMatch(realMatch);
      newMatch.location = this.selectedLocation!.name;
      this.viewedMatches.push(newMatch);
      
      // Update location count
      this.getLocationsCounts();
    });
  }

  removeMatchFromLocation(match: Match) {
    if (!this.selectedLocation) return;
    
    this.megagoal.deleteMatch(match._id).subscribe(() => {
      // Remove from viewed matches
      this.viewedMatches = this.viewedMatches.filter(m => m._id !== match._id);
      
      // Reconstruct RealMatch and add back to available matches
      const realMatch: RealMatch = {
        fixture: {
          id: match.fixture.id,
          referee: '',
          timezone: '',
          date: new Date(match.fixture.timestamp * 1000).toISOString(),
          timestamp: match.fixture.timestamp,
          periods: { first: 0, second: 0 },
          venue: { id: 0, name: '', city: '' },
          status: { long: '', short: match.status, elapsed: 0 }
        },
        league: {
          id: match.league.id,
          name: match.league.name,
          country: '',
          logo: '',
          flag: '',
          season: match.league.season,
          round: match.league.round
        },
        teams: {
          home: { id: match.teams.home.id, name: match.teams.home.name, logo: '', winner: false },
          away: { id: match.teams.away.id, name: match.teams.away.name, logo: '', winner: false }
        },
        goals: match.goals,
        score: { halftime: match.goals, fulltime: match.goals, extratime: match.goals, penalty: match.goals }
      };
      
      this.availableRealMatches.push(realMatch);
      this.applyFilters();
      
      // Update location count
      this.getLocationsCounts();
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
    if (realMatch.score && realMatch.score.fulltime) {
      return `${realMatch.score.fulltime.home} - ${realMatch.score.fulltime.away}`;
    }
    return 'TBD';
  }

  // Helper method to format match result for Match
  getMatchResultFromMatch(match: Match): string {
    if (match.goals) {
      return `${match.goals.home} - ${match.goals.away}`;
    }
    return 'TBD';
  }
}
