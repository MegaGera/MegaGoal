/* 
  Team component to display information about a team
*/

import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgClass, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select'

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { Team } from '../../models/team';
import { RealMatch } from '../../models/realMatch';

import { RealMatchCardComponent } from '../real-match-card/real-match-card.component';
import { MatchParserService } from '../../services/match-parser.service';
import { SeasonInfo } from '../../models/season';
import { Match } from '../../models/match';
import { isNotStartedStatus } from '../../config/matchStatus';
import { Location } from '../../models/location';

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatSelectModule, RealMatchCardComponent, NgClass, NgFor],
  templateUrl: './team.component.html',
  styleUrl: './team.component.css',
  providers: [ImagesService]
})
export class TeamComponent {

  /* Seasons */
  seasons: SeasonInfo[] = [];
  selectedSeason!: SeasonInfo;

  leagues: string[] = [];
  selectedLeagues: string[] = [];

  /* 
    Selected team shared with Leagues components
  */
  queryTeamId!: number;
  querySeasonId!: number;
  team!: Team;
  realMatches: RealMatch[] = [];
  showRealMatches: RealMatch[] = [];
  matches: Match[] = [];
  locations: Location[] = [];

  constructor(private megagoal: MegaGoalService, private router: Router, public images: ImagesService,
    private Activatedroute: ActivatedRoute, public matchParser: MatchParserService) {
    // Get the selected team of the service. If it is undefined navigate to Leagues component
    // this.team = megagoal.getSelectedTeam();

    this.Activatedroute.queryParamMap.subscribe(params => {
      this.queryTeamId = +params.get('id')! || 0;
      this.querySeasonId = +params.get('season')! || 2023;
      this.selectedSeason = this.seasons.find(season => season.id == this.querySeasonId) || this.seasons[0];
      this.init();
    });

  }

  init() {
    this.megagoal.getTeamById(this.queryTeamId).subscribe(result => {
      if (result != undefined) {
        this.team = result;
        this.initializeSeasons();
        this.getRealMatches();
        this.getMatches();
        this.getLocations();
      } else {
        this.router.navigate(["/app/leagues"]);
      }
    }, error => {
      this.router.navigate(["/app/leagues"]);
    })

  }

  /*
    Initialize seasons dynamically from team's seasons array
  */
  initializeSeasons(): void {
    // Convert team's SeasonTeam[] to SeasonInfo[]
    const uniqueSeasons = new Set<string>();
    
    this.team.seasons.forEach(seasonTeam => {
      uniqueSeasons.add(seasonTeam.season);
    });
    
    this.seasons = Array.from(uniqueSeasons)
      .map(seasonStr => {
        const seasonId = parseInt(seasonStr);
        return {
          id: seasonId,
          text: `${seasonId}-${seasonId + 1}`
        };
      })
      .sort((a, b) => b.id - a.id); // Sort in descending order (newest first)
    
    // Set default selected season
    this.selectedSeason = this.seasons.find(season => season.id == this.querySeasonId) || this.seasons[0];
  }

  /*
    Get different leagues from the team
  */
  getDifferentLeagues(): string[] {
    // Extract league numbers from the season array of the team
    const leagueIDs: string[] = this.team.seasons.filter(season => +season.season === this.selectedSeason.id)
      .map(season => season.league);

    // Use Set to get unique league numbers
    const uniqueLeagues: Set<string> = new Set(leagueIDs);

    // Convert Set back to array
    this.leagues = Array.from(uniqueLeagues);
    this.selectedLeagues = this.leagues;
    return this.leagues;
  }

  /*
    Select Season
  */
  selectSeason(season: SeasonInfo): void {
    this.selectedSeason = season;
    this.getRealMatches();
    this.getMatches();
  }

  /*
    Select League
  */
  selectLeague(league: string): void {
    if (this.selectedLeagues.includes(league)) {
      this.selectedLeagues = this.selectedLeagues.filter(l => l !== league);
    } else {
      this.selectedLeagues.push(league);
    }
    this.filterMatches();
  }

  /*
    Get Real Matches by team_id and season
  */
  getRealMatches() {
    this.megagoal.getRealMatchesByTeamIDAndSeason(this.team.team.id, this.selectedSeason.id).subscribe(result => {
      this.realMatches = result;
      this.realMatches.sort(function (x, y) {
        return y.fixture.timestamp - x.fixture.timestamp;
      })
      this.getDifferentLeagues();
      this.filterMatches();
    })
  }

  filterMatches() {
    this.showRealMatches = this.realMatches.filter(match => this.selectedLeagues.includes(match.league.id.toString()));
  }

  /*
    This methods filter Real Matches by status to show them in two columns
  */
  filterStartedRealMatches() {
    return this.showRealMatches.filter(match => !isNotStartedStatus(match.fixture.status.short));
  }
  filterNotStartedRealMatches() {
    return this.showRealMatches.filter(match => isNotStartedStatus(match.fixture.status.short)).sort(function (x, y) {
      return x.fixture.timestamp - y.fixture.timestamp;
    });
  }

  /*
    This methods filter half Real Matches for display in two columns
  */
  filterHalfRealMatches(matches: RealMatch[], col: number) {
    return matches.filter((match, index) => index % 2 === col % 2);
  }

  trackByMatchId(index: number, match: any): number {
    return match.fixture.id; // Ensure each match has a unique identifier
  }

  /*
    Get Matches by team_id and season
  */
  getMatches() {
    this.megagoal.getMatchesByTeamIDAndSeason(this.team.team.id, this.selectedSeason.id).subscribe(result => {
      this.matches = result;
    })
  }

  findRealMatchInMatches(id: number) {
    return this.matches.find(match => match.fixture.id === id);
  }

  getLocations() {
    this.megagoal.getLocationsCounts().subscribe(result => {
      this.locations = <Location[]>result;
    })
  }

}
