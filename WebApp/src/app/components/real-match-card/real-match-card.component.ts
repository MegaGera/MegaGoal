import { Component, ElementRef, HostListener, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select'

import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamEyeCloseF, jamEyeF, jamInfoF } from '@ng-icons/jam-icons';

import { ImagesService } from '../../services/images.service';
import { MegaGoalService } from '../../services/megagoal.service';
import { LeagueColorsService } from '../../services/league-colors.service';
import { Match } from '../../models/match';
import { Location } from '../../models/location';
import { MatchParserService } from '../../services/match-parser.service';


@Component({
  selector: 'app-real-match-card',
  standalone: true,
  imports: [NgIconComponent, CommonModule, MatFormFieldModule, MatSelectModule, FormsModule, RouterLink],
  templateUrl: './real-match-card.component.html',
  styleUrl: './real-match-card.component.css',
  providers: [ImagesService, MegaGoalService, provideNgIconsConfig({
    size: window.innerWidth < 769 ? '1.2em' : '1.5em',
  }), provideIcons({ jamEyeCloseF, jamEyeF, jamInfoF })]
})
export class RealMatchCardComponent implements OnInit {
  @Input() match!: Match;
  @Input() watched: boolean = false;
  @Input() locations!: Location[];
  @Input() size: string = 'lg';
  @Input() interactable: boolean = true;

  isCardExpanded = false;
  private isMobileView = false;

  constructor(
    public images: ImagesService,
    private megaGoal: MegaGoalService,
    public matchParser: MatchParserService,
    private router: Router,
    private host: ElementRef<HTMLElement>,
    private leagueColorsService: LeagueColorsService
  ) {
    this.orderLocations();
  }

  ngOnInit(): void {
    this.updateViewportFlags();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateViewportFlags();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.isMobileView || !this.isCardExpanded) {
      return;
    }

    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.isCardExpanded = false;
    }
  }

  handleTeamClick(teamId: number, event: Event): void {
    if (!this.interactable) {
      return;
    }

    if (this.isMobileView && !this.isCardExpanded) {
      event.preventDefault();
      event.stopPropagation();
      this.isCardExpanded = true;
      return;
    }

    this.isCardExpanded = false;
    this.navigateToTeam(teamId);
  }

  getDate(timestamp: number) {
    let date = new Date((timestamp * 1000));
    return new Date(timestamp * 1000).toLocaleDateString("en-GB");
  }

  getTime(timestamp: number) {
    let date = new Date((timestamp * 1000));
    return date.toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' });
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

  /*
    Get dynamic styles for match card based on league colors
  */
  getMatchCardStyles(): any {
    if (!this.watched || !this.match) {
      return {};
    }
    
    const colors = this.leagueColorsService.getLeagueColors(this.match.league.id);
    return {
      'border': `2px solid ${colors.card_main_color}`,
      'box-shadow': `0 0 4px 2px ${colors.card_trans_color}, 0 4px 4px 0 ${colors.card_trans_color}`
    };
  }

  /*
    Get dynamic styles for team logo based on league colors
  */
  getTeamLogoStyles(): any {
    if (!this.watched || !this.match) {
      return {};
    }
    
    const colors = this.leagueColorsService.getLeagueColors(this.match.league.id);
    return {
      'box-shadow': `0 4px 4px 0 rgba(48,48,48, 0.15), var(--img-team-shadow) ${colors.card_trans_color}`
    };
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
     - Regular Season - [N] -> Matchday - [N]
     - League Stage - [N] -> League R. - [N]
     - Group Stage - [N] -> Group R. - [N]
  */
  parseRoundName(round: string): string {
    // Regular Season - [n] -> Matchday - [n]
    const regularSeasonRegex = /^Regular Season - (\d+)$/;
    const regularSeasonMatch = round.match(regularSeasonRegex);
    if (regularSeasonMatch) {
      return `Matchday - ${regularSeasonMatch[1]}`;
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


  getLocationList() {
    return this.locations
      .filter(loc => !loc.stadium)
      .map(loc => ({ id: loc.id, name: loc.name }));
  }

  getLocationIdFromVenueId(venueId: number) {
    return this.locations.find(loc => loc.venue_id === venueId)?.id ?? venueId;
  }

  navigateToTeam(teamId: number) {
    this.isCardExpanded = false;
    this.router.navigate(['/app/team'], { queryParams: { id: teamId } }).then(() => {
      window.scrollTo(0, 0);
    });
  }

  navigateToMatchInfo() {
    this.router.navigate(['/app/match'], { queryParams: { id: this.match.fixture.id } }).then(() => {
      window.scrollTo(0, 0);
    });
  }

  private updateViewportFlags(): void {
    const previousMobileView = this.isMobileView;
    this.isMobileView = window.innerWidth < 769;
    if (!this.isMobileView && previousMobileView) {
      this.isCardExpanded = false;
    }
  }
}
