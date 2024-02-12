/* 
  Match card component to display information about a match
*/

import { Component } from '@angular/core';

import { MatGridListModule } from '@angular/material/grid-list';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { Match } from '../../models/match';

@Component({
  selector: 'app-match-card',
  standalone: true,
  imports: [MatGridListModule],
  templateUrl: './match-card.component.html',
  styleUrl: './match-card.component.css',
  providers: [ImagesService]
})
export class MatchCardComponent {

  /* 
    Array of matches
  */
  matches: Match[] = [];

  constructor(private megagoal: MegaGoalService, public images: ImagesService) {
    this.getAllMatches();
  }

  /* 
    Get all matches from the service
  */
  getAllMatches() {
    this.megagoal.getAllMatches().subscribe(result => {
      this.matches = <Match[]>result;
    })
  }

}
