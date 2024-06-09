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
import { map, startWith } from 'rxjs/operators';
import { AsyncPipe } from '@angular/common';
import { RouterModule } from '@angular/router';

import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
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
    ReactiveFormsModule, AsyncPipe, MatCheckboxModule, MatGridListModule, MatSelectModule, RouterModule],
  templateUrl: './leagues.component.html',
  styleUrl: './leagues.component.css',
  providers: [ImagesService]
})
export class LeaguesComponent {

  /* Form Controles */
  filterLeaguesControl = new FormControl('');
  setSeasonControl = new FormControl('');

  /* Checkbox booleans */
  checkTopLeagues: boolean = true;
  checkAllLeagues: boolean = false;

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
  selectedSeason!: SeasonInfo;

  /* Teams */
  teams: Team[] = [];

  constructor(private megagoal: MegaGoalService, public images: ImagesService) {
    this.selectedSeason = this.seasons[1];
    this.getLeagues();
  }

  /*
    Get leagues depending on the checkbox checked
  */
  getLeagues(): void {
    if (this.checkTopLeagues) {
      this.getTopLeagues();
    } else {
      this.getAllLeagues();
    }
  }

  /*
    Reset league arrays
  */
  resetLeagues(): void {
    this.leagues = [];
    this.filteredLeagues = of([]);
  }

  /*
    Get all leagues from the service
  */
  getAllLeagues(): void {
    this.megagoal.getAllLeagues().subscribe((result: League[]) => {
      this.leagues = result;
      this.setFilteredLeagues();
    })
  }

  /*
    Get top leagues from the service
  */
  getTopLeagues(): void {
    this.megagoal.getTopLeagues().subscribe((result: League[]) => {
      this.leagues = result;
      this.setFilteredLeagues();
    })
  }

  /*
    Get teams by league with the season selected (if there is one)
  */
  getTeamsByLeague(league: League): void {
    this.selectedLeague = league;
    if (this.selectedSeason != undefined) {
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
    Get teams by league and seasons from the service
  */
  getTeamsByLeagueAndSeason(id: number, season: number): void {
    this.megagoal.getTeamsByLeagueAndSeason(id, season).subscribe((result: Team[]) => {
      this.teams = result;
    })
  }

  /*
    Method to set the filtered leagues from the text form
  */
  setFilteredLeagues(): void {
    this.filteredLeagues = this.filterLeaguesControl.valueChanges.pipe(
      startWith(''),
      map(value => {
        const name = typeof value === 'string' ? value : value ? ['league.name'] : '';
        return name ? this._filter(name as string) : this.leagues.slice();
      }),
    );
  }

  /*
    Method to display filtered leagues from the text form
  */
  displayFn(league: League): string {
    return league && league.league.name ? league.league.name : '';
  }

  /*
    Method to filter leagues from the text form
  */
  private _filter(name: string): League[] {
    const filterValue = name.toLowerCase();
    return this.leagues.filter(league => league.league.name.toLowerCase().includes(filterValue));
  }

  /*
    Method to change the view by the checkboxes
  */
  checkBoxChange(topLeagues: boolean): void {
    this.resetLeagues();
    this.checkTopLeagues = topLeagues;
    this.checkAllLeagues = !topLeagues;
    this.getLeagues();
  }

  /*
    Method to select a team in the shared service with the Team component
  */
  selectTeam(team: Team): void {
    this.megagoal.selectTeam(team);
  }

}
