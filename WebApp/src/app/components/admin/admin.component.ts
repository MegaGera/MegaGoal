import { Component, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MegaGoalService } from '../../services/megagoal.service';
import { LeaguesSettings } from '../../models/leaguesSettings';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  changeUpdateFrequency(league_id: number, update_frequency: number) {
    console.log(league_id, update_frequency)
    this.megagoal.changeUpdateFrequency(league_id, update_frequency).subscribe(result => { });
  }

}
