import { Component, NgModule } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { jamSettingsAlt, jamClose, jamChevronUp, jamChevronDown, jamArrowRight, jamGrid } from '@ng-icons/jam-icons';
import { RealMatchCardComponent } from '../../real-match-card/real-match-card.component';

import { MegaGoalService } from '../../../services/megagoal.service';
import { ImagesService } from '../../../services/images.service';
import { UpdaterService } from '../../../services/updater.service';
import { LeagueColorsService } from '../../../services/league-colors.service';
import { LeaguesSettings } from '../../../models/leaguesSettings';
import { League } from '../../../models/league';
import { Match } from '../../../models/match';

@Component({
  selector: 'app-admin-leagues',
  standalone: true,
  imports: [CommonModule, FormsModule, NgClass, NgIconComponent, RealMatchCardComponent],
  providers: [provideIcons({ jamSettingsAlt, jamClose, jamChevronUp, jamChevronDown, jamArrowRight, jamGrid })],
  templateUrl: './admin-leagues.component.html',
  styleUrl: './admin-leagues.component.css'
})
export class AdminLeaguesComponent {

  leagues: League[] = [];
  leaguesSettings: LeaguesSettings[] = [];
  showSettingsModal: boolean = false;
  showUpdateSections: boolean = false;
  showColorSection: boolean = false;
  selectedLeague: LeaguesSettings | null = null;
  selectedSeason: number | null = null;
  selectedDataUpdateSeason: number | null = null;
  selectedSeasonFrom: number | null = null;
  selectedSeasonTo: number | null = null;
  isUpdateSeasonLoading: boolean = false;
  isMatchesUpdateLoading: boolean = false;
  showGeneralModal: boolean = false;
  isUpdateLeaguesLoading: boolean = false;
  isCheckSeasonsLoading: boolean = false;
  isUpdateTeamsLoading: boolean = false;
  isUpdatePlayersLoading: boolean = false;
  isUpdateLineupsLoading: boolean = false;
  isUpdateEventsLoading: boolean = false;
  isUpdateStatisticsLoading: boolean = false;
  isUpdateStatisticsMissingLoading: boolean = false;
  isUpdateLineupsMissingLoading: boolean = false;
  isUpdateEventsMissingLoading: boolean = false;
  isMultiUpdateLoading: boolean = false;
  
  multiUpdateOptions = {
    matches: false,
    teams: false,
    players: false,
    statistics: false,
    statistics_missing: false,
    lineups: false,
    lineups_missing: false,
    events: false,
    events_missing: false
  };

  shortSeasonsList: number[] = [2024, 2025];

  // Add new league properties
  selectedNewLeague: League | null = null;
  isCreatingLeagueSetting: boolean = false;
  leagueSearchText: string = '';
  
  // Position management properties
  isMovingLeague: boolean = false;
  positionChanges: Map<number, number> = new Map(); // league_id -> new_position
  
  // Order mode properties
  isPositionOrder: boolean = false;
  
  // Color editing properties
  selectedLeagueBaseColor: string = '#000000';
  selectedLeagueCardMainColor: string = '#000000';
  selectedLeagueCardTransColor: string = 'rgba(0,0,0,0.9)';
  isUpdatingColors: boolean = false;
  
  // Preview match card
  previewMatch: Match | null = null;
  originalColors: { base_color?: string, card_main_color?: string, card_trans_color?: string } | null = null;

  constructor(
    private megagoal: MegaGoalService,
    public images: ImagesService,
    private updater: UpdaterService,
    private leagueColorsService: LeagueColorsService
  ) {
    this.init();
  }

  init(): void {
    this.leaguesSettings = [];
    this.getLeaguesSettings();
    this.getLeagues();
  }
  
  getLeaguesSettings() {
    this.megagoal.getLeaguesSettings().subscribe(result => {
      this.leaguesSettings = this.sortLeagues(<LeaguesSettings[]>result);
    })
  }

  getLeagues() {
    this.megagoal.getAllLeagues().subscribe(result => {
      this.leagues = result;
    })
  }

  sortLeagues(leagues: LeaguesSettings[]): LeaguesSettings[] {
    return leagues.sort((a, b) => {
      // First, sort by status priority: daily update active > active > inactive
      const aPriority = this.getStatusPriority(a);
      const bPriority = this.getStatusPriority(b);
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      
      // Within same status, sort by last update date (newest first)
      const aDate = a.last_update ? new Date(a.last_update).getTime() : 0;
      const bDate = b.last_update ? new Date(b.last_update).getTime() : 0;
      
      return bDate - aDate; // Newest first
    });
  }

  getStatusPriority(league: LeaguesSettings): number {
    if (league.is_active && league.daily_update) {
      return 3; // Highest priority: active with daily updates
    } else if (league.is_active) {
      return 2; // Medium priority: active without daily updates
    } else {
      return 1; // Lowest priority: inactive
    }
  }

  openSettingsModal(league: LeaguesSettings): void {
    this.selectedLeague = league;
    this.selectedSeason = league.season;
    this.selectedDataUpdateSeason = league.season;
    this.selectedSeasonFrom = league.season;
    this.selectedSeasonTo = league.season;
    this.selectedNewLeague = null;
    this.leagueSearchText = '';
    
    // Initialize colors from league settings
    this.selectedLeagueBaseColor = league.colors?.base_color || '#000000';
    this.selectedLeagueCardMainColor = league.colors?.card_main_color || '#000000';
    this.selectedLeagueCardTransColor = league.colors?.card_trans_color || 'rgba(0,0,0,0.9)';
    
    // Store original colors to restore on close
    this.originalColors = league.colors ? { ...league.colors } : null;
    
    this.showSettingsModal = true;
    this.showUpdateSections = false;
    this.createPreviewMatch(league);
    this.updatePreviewColors();
  }

  toggleUpdateSections(): void {
    this.showUpdateSections = !this.showUpdateSections;
  }

  closeSettingsModal(): void {
    // Restore original colors if they were changed
    if (this.selectedLeague && this.originalColors && this.originalColors.card_main_color && this.originalColors.card_trans_color) {
      const leagueId = this.selectedLeague.league_id;
      this.leagueColorsService.setTemporaryColors(
        leagueId,
        this.originalColors.card_main_color,
        this.originalColors.card_trans_color
      );
    }
    
    this.showSettingsModal = false;
    this.selectedLeague = null;
    this.selectedNewLeague = null;
    this.leagueSearchText = '';
    this.previewMatch = null;
    this.originalColors = null;
  }

  changeIsActive(league_id: number, is_active: boolean) {
    if (!is_active) {
      const league = this.leaguesSettings.find(l => l.league_id === league_id);
      if (league) {
        league.daily_update = false;
      }
    }
    this.megagoal.changeIsActive(league_id, is_active).subscribe(result => { });
  }

  changeUpdateFrequency(league_id: number, update_frequency: number) {
    this.megagoal.changeUpdateFrequency(league_id, update_frequency).subscribe(result => { });
  }

  changeDailyUpdate(league_id: number, daily_update: boolean) {
    this.megagoal.changeDailyUpdate(league_id, daily_update).subscribe(result => { });
  }

  triggerUpdateSeason(): void {
    if (!this.selectedLeague || this.selectedSeason === null) return;
    this.isUpdateSeasonLoading = true;
    this.updater.updateLeagueSeason(this.selectedLeague.league_id, this.selectedSeason).subscribe({
      next: () => {
        this.isUpdateSeasonLoading = false;
        if (this.selectedLeague) this.selectedLeague.season = this.selectedSeason!;
      },
      error: () => { this.isUpdateSeasonLoading = false; }
    });
  }

  triggerMatchesUpdate(): void {
    if (!this.selectedLeague || this.selectedDataUpdateSeason === null) return;
    this.isMatchesUpdateLoading = true;
    this.updater.updateMatches(this.selectedLeague.league_id, this.selectedDataUpdateSeason).subscribe({
      next: () => { this.isMatchesUpdateLoading = false; },
      error: () => { this.isMatchesUpdateLoading = false; }
    });
  }

  get availableSeasonsForSelectedLeague(): number[] {
    if (!this.selectedLeague) return [];
    const leagueObj = this.leagues.find(l => l.league.id === this.selectedLeague!.league_id);
    if (!leagueObj) return [];
    // Extract and sort years descending
    return leagueObj.seasons.map(s => s.year).sort((a, b) => b - a);
  }

  get availableSeasonsDetails(): any[] {
    if (!this.selectedLeague || !this.selectedLeague.available_seasons) return [];
    return [...this.selectedLeague.available_seasons].sort((a, b) => b.season - a.season);
  }

  get availableLeaguesForAdding(): League[] {
    // Filter out leagues that already have settings
    const existingLeagueIds = this.leaguesSettings.map(ls => ls.league_id);
    const available = this.leagues.filter(league => !existingLeagueIds.includes(league.league.id));
    return available;
  }

  get filteredLeaguesForAdding(): League[] {
    if (!this.leagueSearchText.trim()) {
      return this.availableLeaguesForAdding;
    }
    
    const searchText = this.leagueSearchText.toLowerCase().trim();
    const filtered = this.availableLeaguesForAdding.filter(league => 
      league.league.id.toString().includes(searchText) ||
      league.league.name.toLowerCase().includes(searchText) ||
      league.country.name.toLowerCase().includes(searchText)
    );
    return filtered;
  }

  get sortedLeaguesByPosition(): LeaguesSettings[] {
    if (!this.leaguesSettings || this.leaguesSettings.length === 0) {
      return [];
    }
    
    return [...this.leaguesSettings].filter(league => league && league.league_id).sort((a, b) => {
      const posA = a.position || Number.MAX_SAFE_INTEGER;
      const posB = b.position || Number.MAX_SAFE_INTEGER;
      return posA - posB;
    });
  }

  /*
    Get the base color for a league setting
    Returns the color string if exists, null otherwise
  */
  getLeagueBaseColor(leagueSetting: LeaguesSettings): string | null {
    if (!leagueSetting.colors || !leagueSetting.colors.base_color) {
      return null;
    }
    return leagueSetting.colors.base_color;
  }

  /*
    Check if league has a base color set
  */
  hasLeagueBaseColor(leagueSetting: LeaguesSettings): boolean {
    return this.getLeagueBaseColor(leagueSetting) !== null;
  }

  openGeneralModal(): void {
    this.showGeneralModal = true;
    // Ensure leagues are loaded for the dropdown
    if (this.leagues.length === 0) {
      this.getLeagues();
    }
    // Reset search text to show all leagues
    this.leagueSearchText = '';
  }

  closeGeneralModal(): void {
    this.showGeneralModal = false;
  }

  triggerUpdateLeagues(): void {
    this.isUpdateLeaguesLoading = true;
    this.updater.updateLeagues().subscribe({
      next: () => { this.isUpdateLeaguesLoading = false; },
      error: () => { this.isUpdateLeaguesLoading = false; }
    });
  }

  triggerCheckAvailableSeasons(): void {
    this.isCheckSeasonsLoading = true;
    this.updater.checkAvailableSeasons().subscribe({
      next: () => { 
        this.isCheckSeasonsLoading = false;
        // Refresh the leagues settings to show updated available_seasons
        this.getLeaguesSettings();
      },
      error: () => { this.isCheckSeasonsLoading = false; }
    });
  }

  triggerTeamsUpdate(): void {
    if (!this.selectedLeague || this.selectedDataUpdateSeason === null) return;
    this.isUpdateTeamsLoading = true;
    this.updater.updateTeams(this.selectedLeague.league_id, this.selectedDataUpdateSeason).subscribe({
      next: () => { 
        this.isUpdateTeamsLoading = false;
        // Refresh the leagues settings to show updated teams count
        this.getLeaguesSettings();
      },
      error: () => { this.isUpdateTeamsLoading = false; }
    });
  }

  triggerPlayersUpdate(): void {
    if (!this.selectedLeague || this.selectedDataUpdateSeason === null) return;
    this.isUpdatePlayersLoading = true;
    this.updater.updateLeaguePlayers(this.selectedLeague.league_id, this.selectedDataUpdateSeason).subscribe({
      next: () => { 
        this.isUpdatePlayersLoading = false;
        // Refresh the leagues settings to show updated players count
        this.getLeaguesSettings();
      },
      error: () => { this.isUpdatePlayersLoading = false; }
    });
  }

  triggerLineupsUpdate(): void {
    if (!this.selectedLeague || this.selectedDataUpdateSeason === null) return;
    this.isUpdateLineupsLoading = true;
    this.updater.updateLeagueLineups(this.selectedLeague.league_id, this.selectedDataUpdateSeason).subscribe({
      next: () => { 
        this.isUpdateLineupsLoading = false;
        console.log('Lineups updated successfully');
      },
      error: () => { this.isUpdateLineupsLoading = false; }
    });
  }

  triggerEventsUpdate(): void {
    if (!this.selectedLeague || this.selectedDataUpdateSeason === null) return;
    this.isUpdateEventsLoading = true;
    this.updater.updateLeagueEvents(this.selectedLeague.league_id, this.selectedDataUpdateSeason).subscribe({
      next: () => { 
        this.isUpdateEventsLoading = false;
        console.log('Events updated successfully');
        this.getLeaguesSettings();
      },
      error: () => { this.isUpdateEventsLoading = false; }
    });
  }

  triggerStatisticsUpdate(): void {
    if (!this.selectedLeague || this.selectedDataUpdateSeason === null) return;
    this.isUpdateStatisticsLoading = true;
    this.updater.updateLeagueStatistics(this.selectedLeague.league_id, this.selectedDataUpdateSeason).subscribe({
      next: () => { 
        this.isUpdateStatisticsLoading = false;
        console.log('Statistics updated successfully');
        this.getLeaguesSettings();
      },
      error: () => { this.isUpdateStatisticsLoading = false; }
    });
  }

  triggerStatisticsMissingUpdate(): void {
    if (!this.selectedLeague || this.selectedDataUpdateSeason === null) return;
    this.isUpdateStatisticsMissingLoading = true;
    this.updater.updateLeagueStatisticsMissing(this.selectedLeague.league_id, this.selectedDataUpdateSeason).subscribe({
      next: () => { 
        this.isUpdateStatisticsMissingLoading = false;
        console.log('Statistics (missing only) updated successfully');
        this.getLeaguesSettings();
      },
      error: () => { this.isUpdateStatisticsMissingLoading = false; }
    });
  }

  triggerLineupsMissingUpdate(): void {
    if (!this.selectedLeague || this.selectedDataUpdateSeason === null) return;
    this.isUpdateLineupsMissingLoading = true;
    this.updater.updateLeagueLineupsMissing(this.selectedLeague.league_id, this.selectedDataUpdateSeason).subscribe({
      next: () => { 
        this.isUpdateLineupsMissingLoading = false;
        console.log('Lineups (missing only) updated successfully');
        this.getLeaguesSettings();
      },
      error: () => { this.isUpdateLineupsMissingLoading = false; }
    });
  }

  triggerEventsMissingUpdate(): void {
    if (!this.selectedLeague || this.selectedDataUpdateSeason === null) return;
    this.isUpdateEventsMissingLoading = true;
    this.updater.updateLeagueEventsMissing(this.selectedLeague.league_id, this.selectedDataUpdateSeason).subscribe({
      next: () => { 
        this.isUpdateEventsMissingLoading = false;
        console.log('Events (missing only) updated successfully');
        this.getLeaguesSettings();
      },
      error: () => { this.isUpdateEventsMissingLoading = false; }
    });
  }

  // Multi-season update methods
  hasSelectedOptions(): boolean {
    return Object.values(this.multiUpdateOptions).some(option => option === true);
  }

  selectAllOptions(): void {
    this.multiUpdateOptions = {
      matches: true,
      teams: true,
      players: true,
      statistics: true,
      statistics_missing: true,
      lineups: true,
      lineups_missing: true,
      events: true,
      events_missing: true
    };
  }

  deselectAllOptions(): void {
    this.multiUpdateOptions = {
      matches: false,
      teams: false,
      players: false,
      statistics: false,
      statistics_missing: false,
      lineups: false,
      lineups_missing: false,
      events: false,
      events_missing: false
    };
  }

  triggerMultiSeasonUpdate(): void {
    if (!this.selectedLeague || this.selectedSeasonFrom === null || this.selectedSeasonTo === null) return;
    if (!this.hasSelectedOptions()) return;

    this.isMultiUpdateLoading = true;
    this.updater.multiSeasonUpdate(
      this.selectedLeague.league_id,
      this.selectedSeasonFrom,
      this.selectedSeasonTo,
      this.multiUpdateOptions
    ).subscribe({
      next: (result) => { 
        this.isMultiUpdateLoading = false;
        console.log('Multi-season update completed:', result);
        this.getLeaguesSettings();
        // Reset options after successful update
        this.deselectAllOptions();
      },
      error: (error) => { 
        this.isMultiUpdateLoading = false;
        console.error('Multi-season update failed:', error);
      }
    });
  }

  // Add new league methods
  createLeagueSetting(): void {
    if (!this.selectedNewLeague) return;
    
    // Ensure we have a valid league object with the required properties
    if (!this.selectedNewLeague.league || !this.selectedNewLeague.league.id || !this.selectedNewLeague.league.name) {
      console.error('Invalid league object:', this.selectedNewLeague);
      return;
    }
    
    this.isCreatingLeagueSetting = true;
    this.megagoal.createLeagueSetting(
      this.selectedNewLeague.league.id, 
      this.selectedNewLeague.league.name
    ).subscribe({
      next: () => {
        this.isCreatingLeagueSetting = false;
        this.selectedNewLeague = null;
        this.leagueSearchText = '';
        // Refresh the leagues settings to show the new one
        this.getLeaguesSettings();
      },
      error: () => {
        this.isCreatingLeagueSetting = false;
      }
    });
  }

  filterLeagues(): void {
    // Reset selection if the current selection is no longer in filtered results
    if (this.selectedNewLeague && !this.filteredLeaguesForAdding.includes(this.selectedNewLeague)) {
      this.selectedNewLeague = null;
    }
  }

  onLeagueSelectionChange(): void {
    // This method is called when a league is selected from the dropdown
    // The selectedNewLeague is automatically set by ngModel
  }

  moveLeagueUp(leagueId: number): void {
    this.isMovingLeague = true;
    this.updater.moveLeaguePosition(leagueId, 'up').subscribe({
      next: () => {
        this.isMovingLeague = false;
        this.getLeaguesSettings(); // Refresh the data
      },
      error: () => {
        this.isMovingLeague = false;
      }
    });
  }

  moveLeagueDown(leagueId: number): void {
    this.isMovingLeague = true;
    this.updater.moveLeaguePosition(leagueId, 'down').subscribe({
      next: () => {
        this.isMovingLeague = false;
        this.getLeaguesSettings(); // Refresh the data
      },
      error: () => {
        this.isMovingLeague = false;
      }
    });
  }

  onPositionInputChange(leagueId: number, event: any): void {
    const newPosition = parseInt(event.target.value);
    if (newPosition && newPosition > 0) {
      // Allow any positive number - backend will handle if it's bigger than total leagues
      this.positionChanges.set(leagueId, newPosition);
    } else {
      this.positionChanges.delete(leagueId);
    }
  }

  hasPositionChanged(leagueId: number): boolean {
    return this.positionChanges.has(leagueId);
  }

  applyPositionChange(leagueId: number): void {
    const newPosition = this.positionChanges.get(leagueId);
    if (!newPosition) return;

    this.isMovingLeague = true;
    this.updater.changeLeaguePosition(leagueId, newPosition).subscribe({
      next: () => {
        this.isMovingLeague = false;
        this.positionChanges.delete(leagueId);
        this.getLeaguesSettings(); // Refresh the data
      },
      error: () => {
        this.isMovingLeague = false;
      }
    });
  }

  toggleOrderMode(): void {
    this.isPositionOrder = !this.isPositionOrder;
  }

  onBaseColorChange(): void {
    this.updatePreviewColors();
  }

  onCardMainColorChange(): void {
    this.updatePreviewColors();
  }

  onCardTransColorChange(): void {
    this.updatePreviewColors();
  }

  /*
    Copy base color to card main color
  */
  copyBaseToCardMain(): void {
    this.selectedLeagueCardMainColor = this.selectedLeagueBaseColor;
    this.onCardMainColorChange();
  }

  /*
    Copy base color to card transparent color
  */
  copyBaseToCardTrans(): void {
    // Convert hex to rgba with 0.9 opacity
    const hex = this.selectedLeagueBaseColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    this.selectedLeagueCardTransColor = `rgba(${r}, ${g}, ${b}, 0.9)`;
    this.onCardTransColorChange();
  }

  /*
    Create a mock match for preview
  */
  createPreviewMatch(league: LeaguesSettings): void {
    this.previewMatch = {
      _id: 'preview',
      fixture: {
        id: 999999,
        timestamp: Math.floor(Date.now() / 1000)
      },
      league: {
        id: league.league_id,
        name: league.league_name,
        round: 'Regular Season',
        season: league.season
      },
      teams: {
        home: {
          id: 1,
          name: 'Home Team'
        },
        away: {
          id: 2,
          name: 'Away Team'
        }
      },
      goals: {
        home: 2,
        away: 1
      },
      location: '',
      status: 'FT'
    };
  }

  /*
    Update preview colors in the service temporarily
  */
  updatePreviewColors(): void {
    if (!this.selectedLeague || !this.previewMatch) return;
    
    // Temporarily set colors for preview
    const leagueId = this.selectedLeague.league_id;
    this.leagueColorsService.setTemporaryColors(
      leagueId,
      this.selectedLeagueCardMainColor,
      this.selectedLeagueCardTransColor
    );
  }

  saveLeagueColors(): void {
    if (!this.selectedLeague) return;
    
    this.isUpdatingColors = true;
    const colors = {
      base_color: this.selectedLeagueBaseColor,
      card_main_color: this.selectedLeagueCardMainColor,
      card_trans_color: this.selectedLeagueCardTransColor
    };
    
    this.megagoal.changeLeagueColors(
      this.selectedLeague.league_id,
      colors
    ).subscribe({
      next: () => {
        this.isUpdatingColors = false;
        // Update the local league settings object
        if (this.selectedLeague) {
          this.selectedLeague.colors = colors;
        }
        // Update original colors to the new saved colors
        this.originalColors = { ...colors };
        // Refresh the leagues settings to get updated data
        this.getLeaguesSettings();
      },
      error: () => {
        this.isUpdatingColors = false;
      }
    });
  }
}
