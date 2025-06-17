/* 
  Leagues component

  - "Top" view:
    + Display boxes with the top leagues
    + When a box of a league is clicked, display boxes of the teams of this league in the season chosen in the selector
    + When a box of a team is clicked navigate to the Team component with its information

  - "All" view:
    + Form with a text input to get the name and the ID between all the leagues

*/

import { Component } from '@angular/core';
import { Observable, of } from 'rxjs';
import { AsyncPipe, NgClass, NgFor } from '@angular/common';
import { RouterModule } from '@angular/router';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSelectModule } from '@angular/material/select';

import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamPlus } from '@ng-icons/jam-icons';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { RealMatchCardComponent } from '../real-match-card/real-match-card.component';
import { MatchParserService } from '../../services/match-parser.service';
import { League } from '../../models/league';
import { SeasonInfo } from '../../models/season';
import { Team } from '../../models/team';
import { RealMatch } from '../../models/realMatch';
import { Match } from '../../models/match';
import { Location } from '../../models/location';

@Component({
  selector: 'app-leagues',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatAutocompleteModule,
    ReactiveFormsModule, AsyncPipe, NgClass, MatCheckboxModule, MatGridListModule, 
    MatSelectModule, RouterModule, RealMatchCardComponent, NgIconComponent, NgFor],
  templateUrl: './leagues.component.html',
  styleUrl: './leagues.component.css',
  providers: [ImagesService, provideNgIconsConfig({
    size: '2em',
  }), provideIcons({ jamPlus })]
})
export class LeaguesComponent {

  /* Leagues */
  leagues: League[] = [];
  filteredLeagues: Observable<League[]> = of([]);
  selectedLeague!: League | undefined;
  realMatches: RealMatch[] = [];
  groupedRealMatches: RealMatch[][] = [];
  selectedRound: number = 0;
  matches: Match[] = [];
  locations: Location[] = [];

  /* Seasons */
  seasons: SeasonInfo[] = 
    [{id: 2025, text: "2025-2026"}, 
    {id: 2024, text: "2024-2025"}, 
    {id: 2023, text: "2023-2024"}, 
    {id: 2022, text: "2022-2023"}, 
    {id: 2021 ,text: "2021-2022"}, 
    {id: 2020, text: "2020-2021"}, 
    {id: 2019, text: "2019-2020"}, 
    {id: 2018, text: "2018-2019"}, 
    {id: 2017, text: "2017-2018"}, 
    {id: 2016, text: "2016-2017"}, 
    {id: 2015, text: "2015-2016"}, 
    {id: 2014, text: "2014-2015"}, 
    {id: 2013, text: "2013-2014"}, 
    {id: 2012, text: "2012-2013"}, 
    {id: 2011, text: "2011-2012"}]
  seasonsFiltered: SeasonInfo[] = [];
  selectedSeason!: SeasonInfo;

  /* Teams */
  teams: Team[] = [];
  showTeams: Team[] = [];

  constructor(private megagoal: MegaGoalService, public images: ImagesService, public matchParser: MatchParserService) {
    this.init();
  }

  init(): void {
    this.seasonsFiltered = this.seasons;
    this.selectedSeason = this.seasonsFiltered[0];
    this.getLeagues();
    this.getMatches();
    this.getLocations();
  }

  /*
    Get leagues
  */
  getLeagues(): void {
    this.getTopLeagues();
  }

  /*
    Get top leagues from the backend service
  */
  getTopLeagues(): void {
    this.megagoal.getTopLeagues().subscribe((result: League[]) => {
      this.leagues = result;
    })
  }

  /*
    Get Real Matches by league_id and season
  */
  getRealMatches() {
    if (this.selectedLeague !== undefined && this.selectedSeason !== undefined) {
      this.megagoal.getRealMatchesByLeagueIDAndSeason(this.selectedLeague.league.id, this.selectedSeason.id).subscribe(result => {
        this.realMatches = result;
        this.realMatches.sort(function(x, y){
            return y.fixture.timestamp - x.fixture.timestamp;
        })
        this.groupRealMatches();
      })
    } else {
      this.realMatches = [];
      this.groupedRealMatches = [];
    }
  }

  /*
    This method group Real Matches by round in a matrix to have easy acces to them
  */
  groupRealMatches() {
    // Step 1: Group matches by round using forEach
    const groupedMatches: { [round: string]: RealMatch[] } = {};

    this.realMatches.forEach(match => {
        const round = match.league.round;
        if (!groupedMatches[round]) {
            groupedMatches[round] = [];
        }
        groupedMatches[round].push(match);
    });

    // Step 2: Extract and sort "Regular Season - n" rounds
    const regularSeasonMatches = Object.keys(groupedMatches)
        .filter(round => round.startsWith("Regular Season"))
        .sort((a, b) => {
            const roundA = parseInt(a.split(" - ")[1], 10);
            const roundB = parseInt(b.split(" - ")[1], 10);
            return roundA - roundB;
        })
        .map(round => groupedMatches[round]);

    // Step 3: Extract non-regular season matches
    const otherMatches = Object.keys(groupedMatches)
        .filter(round => !round.startsWith("Regular Season"))
        .map(round => groupedMatches[round]);

    // Step 4: Combine sorted regular season matches with other matches
    this.groupedRealMatches = [...regularSeasonMatches, ...otherMatches];

    // Step 5: Reverse iterate to find the last played round
    for (let i = regularSeasonMatches.length - 1; i >= 0; i--) {
        let matchesInRound = regularSeasonMatches[i];
        if (matchesInRound.some(match => match.fixture.status.short === "FT")) {
            this.selectedRound = i;
            break;
        }
    }
  }

  /*
    This method change the round of the matches by the arrows
  */
  changeRound(n: number) {
    this.getMatches();
    if (this.selectedRound + n >= 0 && this.selectedRound + n < this.groupedRealMatches.length) {
      this.selectedRound = this.selectedRound + n;
    }
  }

  getGroupedRealMatchesKeys(): string[] {
    return Object.keys(this.groupedRealMatches);
  }

  /*
    Get Real Matches by team_id and season
  */
  getMatches() {
    this.megagoal.getAllMatches().subscribe(result => {
      this.matches = result;
    })
  }

  findRealMatchInMatches(id: number) {
    return this.matches.find(match => match.fixture.id === id);
  }

  /*
    This methods filter half Real Matches for display in two columns
  */
  filterHalfRealMatches(matches: RealMatch[], col: number) {
    if (matches != undefined && matches.length > 0) {
      return matches.filter((match, index) => index % 2 === col % 2);
    }
    return [];
  }

  trackByMatchId(index: number, match: any): number {
    return match.fixture.id; // Ensure each match has a unique identifier
  }

  getLocations() {
    this.megagoal.getLocationsCounts().subscribe(result => {
      this.locations = <Location[]>result;
    })
  }

  selectLeague(league: League): void {
    // If the league selected is the same, show all the leagues and remove the teams
    if (this.selectedLeague != undefined && this.selectedLeague.league.id === league.league.id) {
      this.selectedLeague = undefined;
      this.selectedRound = 0;
      this.seasonsFiltered = this.seasons;
      this.teams = [];
      this.showTeams = [];
      this.realMatches = [];
      this.groupedRealMatches = [];
    } else {
      this.selectedLeague = league;
      this.getTeamsByLeague(league);
    }
  }

  /*
    Get teams by league with the season selected (if there is one)
  */
  getTeamsByLeague(league: League): void {
    // Show seasons that are in the league
    this.seasonsFiltered = this.seasons.filter(season =>
      league.seasons.find(seasonLeague => seasonLeague.year === season.id) != undefined);

    // If there is a season selected and it is in the league, get the teams
    if (this.selectedSeason != undefined && league.seasons.find(season => season.year == this.selectedSeason.id) !== undefined) {
      this.getTeamsByLeagueAndSeason(league.league.id, this.selectedSeason.id);
    } else {

      // Else, select the first season that is in the league
      this.selectedSeason = this.seasonsFiltered[0];
      this.getTeamsByLeagueAndSeason(league.league.id, this.selectedSeason.id);
    }
  
  }

  /*
    Get teams by season with the league selected (if there is one)
  */
  getTeamsBySeason(season: SeasonInfo): void {
    this.selectedSeason = season;
    if (this.selectedLeague != undefined) {
      this.getTeamsByLeagueAndSeason(this.selectedLeague.league.id, season.id);
    }
  }

  /*
    Get teams by league and seasons from the backend service
  */
  getTeamsByLeagueAndSeason(id: number, season: number): void {
    this.megagoal.getTeamsByLeagueAndSeason(id, season).subscribe((result: Team[]) => {
      this.teams = result;
      this.showTeams = this.teams.slice(0, 24);
      this.getRealMatches();
    })
  }

  /*
    Method to show all teams trigerred by a button
  */
  showAllTeams(): void {
    this.showTeams = this.teams;
  }

  /*
    Method to select a team in the shared service with the Team component
  */
  selectTeam(team: Team): void {
    this.megagoal.selectTeam(team);
  }

}
