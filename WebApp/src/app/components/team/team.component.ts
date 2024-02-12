/* 
  Team component to display information about a team
*/

import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { Team } from '../../models/team';

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [],
  templateUrl: './team.component.html',
  styleUrl: './team.component.css',
  providers: [ImagesService]
})
export class TeamComponent {

  /* 
    Selected team shared with Leagues components
  */
  team!: Team;

  constructor(private megagoal: MegaGoalService, private router: Router, public images: ImagesService) {
    // Get the selected team of the service. If it is undefined navigate to Leagues component
    this.team = megagoal.getSelectedTeam();
    if (this.team == undefined) {
      router.navigate(["/leagues"]);
    }
  }

  getDifferentLeagues(): string[] {
    // Extract league numbers from the season array of the team
    const leagueIDs: string[] = this.team.seasons.map(season => season.league);

    // Use Set to get unique league numbers
    const uniqueLeagues: Set<string> = new Set(leagueIDs);

    // Convert Set back to array
    return Array.from(uniqueLeagues);
  }

}
