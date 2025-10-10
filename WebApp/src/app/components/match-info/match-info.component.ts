/* 
  Match Info component to display detailed information about a specific match
*/

import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { RealMatch, TeamStatistics } from '../../models/realMatch';
import { LeagueHeaderComponent } from '../league-header/league-header.component';
import { GeneralMatchCardComponent } from '../general-match-card/general-match-card.component';
import { MatchStatisticsComponent } from '../match-statistics/match-statistics.component';

@Component({
  selector: 'app-match-info',
  standalone: true,
  imports: [CommonModule, LeagueHeaderComponent, GeneralMatchCardComponent, MatchStatisticsComponent],
  templateUrl: './match-info.component.html',
  styleUrl: './match-info.component.css',
  providers: [ImagesService]
})
export class MatchInfoComponent {

  queryMatchId!: number;
  match!: RealMatch;
  homeStatistics: TeamStatistics | undefined;
  awayStatistics: TeamStatistics | undefined;
  loading: boolean = true;

  constructor(
    private megagoal: MegaGoalService, 
    private router: Router, 
    public images: ImagesService,
    private activatedRoute: ActivatedRoute
  ) {
    this.activatedRoute.queryParamMap.subscribe(params => {
      this.queryMatchId = +params.get('id')! || 0;
      this.init();
    });
  }

  init() {
    this.megagoal.getRealMatchById(this.queryMatchId).subscribe(result => {
      if (result != undefined) {
        this.match = result;
        if (this.match.statistics && this.match.statistics.length >= 2) {
          this.homeStatistics = this.match.statistics[0];
          this.awayStatistics = this.match.statistics[1];
        }
        this.loading = false;
      } else {
        this.router.navigate(["/app/matches"]);
      }
    }, error => {
      this.router.navigate(["/app/matches"]);
    });
  }
}

