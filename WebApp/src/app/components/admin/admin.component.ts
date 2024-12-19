import { Component, NgModule } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MegaGoalService } from '../../services/megagoal.service';
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
  
  constructor(private megagoal: MegaGoalService) {
    this.init();
  }

  init(): void {
    this.leaguesSettings = [];
    this.getLeaguesSettings();
  }
  
  getLeaguesSettings() {
    this.megagoal.getLeaguesSettings().subscribe(result => {
      this.leaguesSettings = <LeaguesSettings[]>result;
    })
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
