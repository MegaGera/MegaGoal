/*
  Service to mantain state between de components and for get data from an API by HTTP Requests
*/

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { League } from '../models/league';
import { Match } from '../models/match';
import { Team } from '../models/team';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MegaGoalService {

  /*
    URL of the API server
  */
  url = "http://localhost:3150";
  
  /*
    Selected team variable shared between components
  */
  selectedTeam!: Team;

  constructor(private http: HttpClient) { }
  
  /*
    Set of the selected team
  */
  selectTeam(team: Team): void {
    this.selectedTeam = team;
  }
  
  /*
    Get of the selected team
  */
  getSelectedTeam(): Team {
    return this.selectedTeam;
  }
 
  /*
    Method to get all the Matches from the API
  */
  getAllMatches(): Observable<Match[]> {
    return this.http.get<Match[]>(this.url + '/matches/');
  }

  /*
    Method to get all the Leagues from the API
  */
  getAllLeagues(): Observable<League[]> {
    return this.http.get<League[]>(this.url + '/leagues/');
  }

  /*
    Method to get all the Leagues by country from the API
  */
  getAllLeaguesFromCountry(countryName: string): Observable<League[]> {
    return this.http.get<League[]>(this.url + '/leagues/' + countryName);
  }

  /*
    Method to get all the Teams by league and season from the API
  */
  getTeamsByLeagueAndSeason(league_id: number, season: number): Observable<Team[]> {
    let params = new HttpParams().set('league_id', league_id).set('season', season); 
    return this.http.get<Team[]>(this.url + '/teams/', {params: params});
  }

  /*
    Method to get the top Leagues from the API
  */
  getTopLeagues(): Observable<League[]> {
    return this.http.get<League[]>(this.url + '/leaguestop/');
  }

}
