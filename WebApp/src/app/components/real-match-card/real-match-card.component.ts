import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';

import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select'

import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamEyeCloseF, jamEyeF } from '@ng-icons/jam-icons';

import { ImagesService } from '../../services/images.service';
import { MegaGoalService } from '../../services/megagoal.service';
import { Match } from '../../models/match';
import { Location } from '../../models/location';

@Component({
  selector: 'app-real-match-card',
  standalone: true,
  imports: [NgIconComponent, CommonModule, MatFormFieldModule, MatSelectModule, FormsModule],
  templateUrl: './real-match-card.component.html',
  styleUrl: './real-match-card.component.css',
  providers: [ImagesService, MegaGoalService, provideNgIconsConfig({
    size: '1.5em',
  }), provideIcons({ jamEyeCloseF, jamEyeF })]
})
export class RealMatchCardComponent {
  @Input() match!: Match;
  @Input() watched: boolean = false;
  @Input() locations!: Location[];

  constructor(public images: ImagesService, private megaGoal: MegaGoalService) { }

  getDate(timestamp: number) {
    let date = new Date((timestamp * 1000));
    return new Date(timestamp * 1000).toLocaleDateString("en-GB");
  }

  createMatch() {
    if (!this.watched) {
      this.watched = true;
      this.megaGoal.createMatch(this.match).subscribe(result => {
        console.log(result)
      })
    }
  }

  leagueCSSSelector(leagueId: number) {
    if (this.watched){
      if (leagueId == 141) {
        return 'SegundaDivision';
      } else if (leagueId == 140) {
        return 'PrimeraDivision';
      } else if (leagueId == 39) {
        return 'PremierLeague';
      } else if (leagueId == 2) {
        return 'ChampionsLeague';
      } else if (leagueId == 3) {
        return 'EuropaLeague';
      } else if (leagueId == 78) {
        return 'Bundesliga';
      } else if (leagueId == 61) {
        return 'Ligue1';
      } else if (leagueId == 135) {
        return 'SerieA';
      } else if (leagueId == 143) {
        return 'CopaDelRey';
      } else if (leagueId == 45) {
        return 'FaCup';
      } else if (leagueId == 556) {
        return 'SpanishSupercup';
      } else if (leagueId == 531) {
        return 'UefaSupercup';
      } else if (leagueId == 848) {
        return 'ConferenceLeague';
      } else if (leagueId == 1) {
        return 'WorldCup';
      } else if (leagueId == 4) {
        return 'EuroCup';
      } else {
        return 'None';
      }
    }
    return '';
  }

  setLocation(fixtureId: number, location: string) {
    this.megaGoal.setLocation(fixtureId, location).subscribe(result => {
      console.log(result)
    });
  }

  getDefaultLeagueImg(event: any) {
    //event.target.src = environment.serverURL + "/assets/img/leagues/back/0.png"
  }

}
