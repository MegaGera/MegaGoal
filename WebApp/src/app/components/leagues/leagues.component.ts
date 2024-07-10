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
import { AsyncPipe, NgClass } from '@angular/common';
import { RouterModule } from '@angular/router';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSelectModule } from '@angular/material/select'

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { League } from '../../models/league';
import { SeasonInfo } from '../../models/season';
import { Team } from '../../models/team';

@Component({
  selector: 'app-leagues',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatAutocompleteModule,
    ReactiveFormsModule, AsyncPipe, NgClass, MatCheckboxModule, MatGridListModule, MatSelectModule, RouterModule],
  templateUrl: './leagues.component.html',
  styleUrl: './leagues.component.css',
  providers: [ImagesService]
})
export class LeaguesComponent {

  /* Leagues */
  leagues: League[] = [];
  filteredLeagues: Observable<League[]> = of([]);
  selectedLeague!: League;

  /* Seasons */
  seasons: SeasonInfo[] = 
    [{id: 2024, text: "2024-2025"}, 
    {id: 2023, text: "2023-2024"}, 
    {id: 2022, text: "2022-2023"}, 
    {id: 2021 ,text: "2021-2022"}, 
    {id: 2020, text: "2020-2021"}, 
    {id: 2019, text: "2019-2020"}, 
    {id: 2018, text: "2018-2019"}, 
    {id: 2017, text: "2017-2018"}, 
    {id: 2016, text: "2016-2017"}, 
    {id: 2015, text: "2015-2016"}, 
    {id: 2014, text: "2014-2015"}]
  seasonsFiltered: SeasonInfo[] = [];
  selectedSeason!: SeasonInfo;

  /* Teams */
  teams: Team[] = [];

  constructor(private megagoal: MegaGoalService, public images: ImagesService) {
    this.seasonsFiltered = this.seasons;
    this.selectedSeason = this.seasonsFiltered[1];
    this.getLeagues();
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
    Get teams by league with the season selected (if there is one)
  */
  getTeamsByLeague(league: League): void {
    this.selectedLeague = league;

    // Show seasons that are in the league
    this.seasonsFiltered = this.seasons.filter(season =>
      league.seasons.find(seasonLeague => seasonLeague.year === season.id) != undefined);

    // If there is a season selected and it is in the league, get the teams
    if (this.selectedSeason != undefined && this.selectedLeague.seasons.find(season => season.year == this.selectedSeason.id) !== undefined) {
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
    })
  }

  /*
    Method to select a team in the shared service with the Team component
  */
  selectTeam(team: Team): void {
    this.megagoal.selectTeam(team);
  }

}
