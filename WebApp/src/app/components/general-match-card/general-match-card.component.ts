import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamEyeCloseF, jamEyeF } from '@ng-icons/jam-icons';

import { ImagesService } from '../../services/images.service';
import { MegaGoalService } from '../../services/megagoal.service';
import { MatchParserService } from '../../services/match-parser.service';
import { RealMatch } from '../../models/realMatch';
import { Match } from '../../models/match';
import { Location } from '../../models/location';

@Component({
  selector: 'app-general-match-card',
  standalone: true,
  imports: [NgIconComponent, CommonModule, MatFormFieldModule, MatSelectModule, FormsModule],
  templateUrl: './general-match-card.component.html',
  styleUrl: './general-match-card.component.css',
  providers: [ImagesService, MegaGoalService, provideNgIconsConfig({
    size: '1.2em',
  }), provideIcons({ jamEyeCloseF, jamEyeF })]
})
export class GeneralMatchCardComponent implements OnInit {
  @Input() realMatch!: RealMatch;
  
  match!: Match;
  watched: boolean = false;
  locations: Location[] = [];

  constructor(
    public images: ImagesService, 
    private megaGoal: MegaGoalService, 
    public matchParser: MatchParserService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadMatchData();
    this.getLocations();
  }

  loadMatchData() {
    // Check if match is already watched
    this.megaGoal.getMatchesByFixtureId(this.realMatch.fixture.id).subscribe((result: Match[]) => {
      if (result && result.length > 0) {
        this.match = result[0];
        this.watched = true;
      } else {
        this.match = this.matchParser.realMatchToMatch(this.realMatch);
        this.watched = false;
      }
    }, (error: any) => {
      this.match = this.matchParser.realMatchToMatch(this.realMatch);
      this.watched = false;
    });
  }

  getLocations() {
    this.megaGoal.getLocationsCounts().subscribe(result => {
      this.locations = <Location[]>result;
      this.orderLocations();
    });
  }

  orderLocations() {
    if (this.locations) {
      this.locations.sort((a, b) => a.matchCount > b.matchCount ? -1 : 1);
    }
  }

  getDate(timestamp: number) {
    return new Date(timestamp * 1000).toLocaleDateString("en-GB", {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getTime(timestamp: number) {
    let date = new Date((timestamp * 1000));
    return date.toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' });
  }

  createMatch() {
    if (!this.watched) {
      this.watched = true;
      this.megaGoal.createMatch(this.matchParser.matchToMatchRequest(this.match)).subscribe(result => {
        this.loadMatchData(); // Reload to get the created match with _id
      });
    } else {
      this.watched = false;
      this.megaGoal.deleteMatch(this.match.fixture.id).subscribe(result => {});
    }
  }

  setLocation(fixtureId: number, location: string) {
    const existingLocation = this.locations.find(loc => loc.venue_id === parseInt(location));
    if (existingLocation) {
      location = existingLocation.id;
    }
    this.megaGoal.setLocation(fixtureId, location, this.match.venue).subscribe(result => {});
  }

  getLocationList() {
    return this.locations
      .filter(loc => !loc.stadium)
      .map(loc => ({ id: loc.id, name: loc.name }));
  }

  getLocationIdFromVenueId(venueId: number) {
    return this.locations.find(loc => loc.venue_id === venueId)?.id ?? venueId;
  }

  navigateToTeam(teamId: number) {
    this.router.navigate(['/app/team'], { 
      queryParams: { id: teamId } 
    }).then(() => {
      window.scrollTo(0, 0);
    });
  }

  leagueCSSSelector(leagueId: number) {
    if (this.watched) {
      if (leagueId == 141) return 'SegundaDivision';
      else if (leagueId == 140) return 'PrimeraDivision';
      else if (leagueId == 39) return 'PremierLeague';
      else if (leagueId == 2) return 'ChampionsLeague';
      else if (leagueId == 3) return 'EuropaLeague';
      else if (leagueId == 78) return 'Bundesliga';
      else if (leagueId == 61) return 'Ligue1';
      else if (leagueId == 135) return 'SerieA';
      else if (leagueId == 143) return 'CopaDelRey';
      else if (leagueId == 45) return 'FaCup';
      else if (leagueId == 556) return 'SpanishSupercup';
      else if (leagueId == 531) return 'UefaSupercup';
      else if (leagueId == 848) return 'ConferenceLeague';
      else if (leagueId == 1) return 'WorldCup';
      else if (leagueId == 4) return 'EuroCup';
      else if (leagueId == 9) return 'AmericanCup';
      else if (leagueId == 15) return 'ClubWorldCup';
      else return 'None';
    }
    return '';
  }
}

