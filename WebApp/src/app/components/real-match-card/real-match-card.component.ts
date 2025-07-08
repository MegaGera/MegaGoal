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
import { MatchParserService } from '../../services/match-parser.service';


@Component({
  selector: 'app-real-match-card',
  standalone: true,
  imports: [NgIconComponent, CommonModule, MatFormFieldModule, MatSelectModule, FormsModule],
  templateUrl: './real-match-card.component.html',
  styleUrl: './real-match-card.component.css',
  providers: [ImagesService, MegaGoalService, provideNgIconsConfig({
    size: window.innerWidth < 769 ? '1.2em' : '1.5em',
  }), provideIcons({ jamEyeCloseF, jamEyeF })]
})
export class RealMatchCardComponent {
  @Input() match!: Match;
  @Input() watched: boolean = false;
  @Input() locations!: Location[];
  @Input() size: string = 'lg';

  constructor(public images: ImagesService, private megaGoal: MegaGoalService, public matchParser: MatchParserService) {
    this.orderLocations();
  }

  getDate(timestamp: number) {
    let date = new Date((timestamp * 1000));
    return new Date(timestamp * 1000).toLocaleDateString("en-GB");
  }

  createMatch() {
    if (!this.watched) {
      this.watched = true;
      this.megaGoal.createMatch(this.matchParser.matchToMatchRequest(this.match)).subscribe(result => { })
    } else {
      this.watched = false;
      this.megaGoal.deleteMatch(this.match.fixture.id).subscribe(result => { });
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
      } else if (leagueId == 9) {
        return 'AmericanCup';
      } else if (leagueId == 15) {
        return 'ClubWorldCup';
      } else {
        return 'None';
      }
    }
    return '';
  }

  setLocation(fixtureId: number, location: string) {
    const existingLocation = this.locations.find(loc => loc.venue_id === parseInt(location));
    if (existingLocation) {
      location = existingLocation.id;
    }
    this.megaGoal.setLocation(fixtureId, location, this.match.venue).subscribe(result => { });
  }

  getDefaultLeagueImg(event: any) {
    //event.target.src = environment.serverURL + "/assets/img/leagues/back/0.png"
  }

  isLive() {
    const liveStatuses = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT'];
    return liveStatuses.includes(this.match.status);
  }

  orderLocations() {
    if (this.locations) {
      this.locations.sort((a, b) => a.matchCount > b.matchCount ? -1 : 1);
    }
  }

  /*
    Parse the round name:
     - Regular Season - [N] -> Round - [N]
     - League Stage - [N] -> League R. - [N]
     - Group Stage - [N] -> Group R. - [N]
  */
  parseRoundName(round: string): string {
    // Regular Season - [n] -> Round - [n]
    const regularSeasonRegex = /^Regular Season - (\d+)$/;
    const regularSeasonMatch = round.match(regularSeasonRegex);
    if (regularSeasonMatch) {
      return `Round - ${regularSeasonMatch[1]}`;
    }

    // League Stage - [n] -> League R. - [n]
    const leagueStageRegex = /^League Stage - (\d+)$/;
    const leagueStageMatch = round.match(leagueStageRegex);
    if (leagueStageMatch) {
      return `League R. - ${leagueStageMatch[1]}`;
    }

    // Group Stage - [n] -> Group R. - [n]
    const groupStageRegex = /^Group Stage - (\d+)$/;
    const groupStageMatch = round.match(groupStageRegex);
    if (groupStageMatch) {
      return `Group R. - ${groupStageMatch[1]}`;
    }

    return round;
  }

}
