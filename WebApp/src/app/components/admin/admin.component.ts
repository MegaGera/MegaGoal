import { Component, NgModule } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { jamSettingsAlt, jamClose } from '@ng-icons/jam-icons';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { UpdaterService } from '../../services/updater.service';
import { LeaguesSettings } from '../../models/leaguesSettings';
import { League } from '../../models/league';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, NgClass, NgIconComponent],
  providers: [provideIcons({ jamSettingsAlt, jamClose })],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent {

  leagues: League[] = [];
  leaguesSettings: LeaguesSettings[] = [];
  showSettingsModal: boolean = false;
  selectedLeague: LeaguesSettings | null = null;
  selectedSeason: number | null = null;
  selectedFullUpdateSeason: number | null = null;
  isUpdateSeasonLoading: boolean = false;
  isFullUpdateLoading: boolean = false;
  showSeasonsStatusList: boolean = false;
  showGeneralModal: boolean = false;
  isUpdateLeaguesLoading: boolean = false;

  seasonsList: number[] = [2020, 2021, 2022, 2023, 2024, 2025];
  shortSeasonsList: number[] = [2024, 2025];

  constructor(
    private megagoal: MegaGoalService,
    public images: ImagesService,
    private updater: UpdaterService
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
    this.selectedFullUpdateSeason = league.season;
    this.showSettingsModal = true;
  }

  closeSettingsModal(): void {
    this.showSettingsModal = false;
    this.selectedLeague = null;
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

  triggerFullUpdate(): void {
    if (!this.selectedLeague || this.selectedFullUpdateSeason === null) return;
    this.isFullUpdateLoading = true;
    this.updater.updateMatches(this.selectedLeague.league_id, this.selectedFullUpdateSeason).subscribe({
      next: () => { this.isFullUpdateLoading = false; },
      error: () => { this.isFullUpdateLoading = false; }
    });
  }

  get availableSeasonsForSelectedLeague(): number[] {
    if (!this.selectedLeague) return [];
    const leagueObj = this.leagues.find(l => l.league.id === this.selectedLeague!.league_id);
    if (!leagueObj) return [];
    // Extract and sort years descending
    return leagueObj.seasons.map(s => s.year).sort((a, b) => b - a);
  }

  toggleSeasonsStatusList(): void {
    this.showSeasonsStatusList = !this.showSeasonsStatusList;
  }

  openGeneralModal(): void {
    this.showGeneralModal = true;
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

}
