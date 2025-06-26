import { Component, NgModule } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { LeaguesSettings } from '../../models/leaguesSettings';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, NgClass],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent {

  leaguesSettings: LeaguesSettings[] = [];
  
  constructor(
    private megagoal: MegaGoalService,
    public images: ImagesService
  ) {
    this.init();
  }

  init(): void {
    this.leaguesSettings = [];
    this.getLeaguesSettings();
  }
  
  getLeaguesSettings() {
    this.megagoal.getLeaguesSettings().subscribe(result => {
      this.leaguesSettings = this.sortLeagues(<LeaguesSettings[]>result);
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

}
