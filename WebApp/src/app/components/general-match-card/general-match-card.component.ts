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
import { LeagueColorsService } from '../../services/league-colors.service';
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
    private router: Router,
    private leagueColorsService: LeagueColorsService
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

  /*
    Get dynamic styles for match card container based on league colors
  */
  getMatchCardStyles(): any {
    if (!this.watched || !this.realMatch) {
      return {};
    }
    
    const colors = this.leagueColorsService.getLeagueColors(this.realMatch.league.id);
    return {
      'border': `3px solid ${colors.card_main_color}`,
      'box-shadow': `0 0 8px 2px ${colors.card_trans_color}`
    };
  }

  /*
    Get dynamic styles for team logo based on league colors
  */
  getTeamLogoStyles(): any {
    if (!this.watched || !this.realMatch) {
      return {};
    }
    
    const colors = this.leagueColorsService.getLeagueColors(this.realMatch.league.id);
    return {
      'box-shadow': `0 6px 12px 0 rgba(48,48,48, 0.12), 0 0 0 10px ${colors.card_trans_color}`
    };
  }

  /*
    Handle team logo hover
  */
  onTeamLogoHover(event: MouseEvent): void {
    if (!this.watched || !this.realMatch) return;
    const target = event.currentTarget as HTMLElement;
    const colors = this.leagueColorsService.getLeagueColors(this.realMatch.league.id);
    target.style.boxShadow = `0 8px 16px 0 rgba(48,48,48, 0.18), 0 0 0 10px ${colors.card_trans_color}`;
  }

  /*
    Handle team logo leave
  */
  onTeamLogoLeave(event: MouseEvent): void {
    if (!this.watched || !this.realMatch) return;
    const target = event.currentTarget as HTMLElement;
    const styles = this.getTeamLogoStyles();
    target.style.boxShadow = styles['box-shadow'] || '';
  }
}

