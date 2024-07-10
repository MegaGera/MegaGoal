/*
  Service to mantain state between de components and for get data from an API by HTTP Requests
*/

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { League } from '../models/league';
import { Match } from '../models/match';
import { Team } from '../models/team';
import { Location } from '../models/location';
import { Observable } from 'rxjs';
import { RealMatch } from '../models/realMatch';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MegaGoalService {

  /*
    URL of the API server
  */
  url = environment.serverURL + ":" + environment.serverPort;
  options = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: environment.production ? true : false
  }
  
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
    return this.http.get<Match[]>(this.url + '/match/', this.options);
  }

  /*
    Method to get all the Leagues from the API
  */
  getAllLeagues(): Observable<League[]> {
    return this.http.get<League[]>(this.url + '/league/', this.options);
  }

  /*
    Method to get all the Leagues by country from the API
  */
  getAllLeaguesFromCountry(countryName: string): Observable<League[]> {
    return this.http.get<League[]>(this.url + '/league/' + countryName, this.options);
  }

  /*
    Method to get all the Teams by league and season from the API
  */
  getTeamsByLeagueAndSeason(league_id: number, season: number): Observable<Team[]> {
    let params = new HttpParams().set('league_id', league_id).set('season', season); 
    return this.http.get<Team[]>(this.url + '/team/', { ...this.options, params: params });
  }

  /*
    Method to get a Teams by its id from the API
  */
    getTeamById(team_id: number): Observable<Team> {
      return this.http.get<Team>(this.url + '/team/' + team_id, this.options);
    }

  /*
    Method to get the top Leagues from the API
  */
  getTopLeagues(): Observable<League[]> {
    return this.http.get<League[]>(this.url + '/league/top/', this.options);
  }

  /*
    Method to get all the Teams by league and season from the API
  */
  getRealMatchesByTeamIDAndSeason(team_id: number, season: number): Observable<RealMatch[]> {
    let params = new HttpParams().set('team_id', team_id).set('season', season); 
    return this.http.get<RealMatch[]>(this.url + '/real_match/', { ...this.options, params: params });
  }

  /*
    Method to create a new Match from a Real Match
  */
  createMatch(match: Match): Observable<Match> {
    console.log(match)
    return this.http.post<Match>(this.url + '/match/', match, this.options);
  }

  /*
    Method to get all the Teams by league and season from the API
  */
  getMatchesByTeamIDAndSeason(team_id: number, season: number): Observable<Match[]> {
    let params = new HttpParams().set('team_id', team_id).set('season', season); 
    return this.http.get<Match[]>(this.url + '/match/', { ...this.options, params: params });
  }
  
  /*
    Method to set a Location for a Match
  */
  setLocation(fixtureId: number, location: string): Observable<number> {
    let body = {
      fixtureId: fixtureId,
      location: location
    }
    return this.http.post<number>(this.url + '/match/set_location', body, this.options);
  }

  /*
    Method to get all the Locations from the API
  */
  getLocations(): Observable<Location[]> {
    return this.http.get<Location[]>(this.url + '/location/', this.options);
  }

}
