/*
  Service to mantain state between de components and for get data from an API by HTTP Requests
*/

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { League } from '../models/league';
import { Match } from '../models/match';
import { Team, shortTeam } from '../models/team';
import { Location } from '../models/location';
import { Observable } from 'rxjs';
import { RealMatch } from '../models/realMatch';
import { environment } from '../../environments/environment';
import { LeaguesSettings } from '../models/leaguesSettings';
import { MatchRequest } from '../models/matchRequest';

@Injectable({
  providedIn: 'root'
})
export class MegaGoalService {

  /*
    URL of the API server
  */
  url = environment.serverURL;
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
    Method to get all the Teams by multiple league IDs from the API
  */
  getTeamsByTopLeague(): Observable<shortTeam[]> {
    return this.http.get<shortTeam[]>(this.url + '/team/top_leagues', { ...this.options });
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
    Method to get Real Matches by team and season from the API
  */
  getRealMatchesByTeamIDAndSeason(team_id: number, season: number): Observable<RealMatch[]> {
    let params = new HttpParams().set('team_id', team_id).set('season', season); 
    return this.http.get<RealMatch[]>(this.url + '/real_match/', { ...this.options, params: params });
  }

  /*
    Method to get Real Matches by league and season from the API
  */
  getRealMatchesByLeagueIDAndSeason(league_id: number, season: number): Observable<RealMatch[]> {
    let params = new HttpParams().set('league_id', league_id).set('season', season);
    return this.http.get<RealMatch[]>(this.url + '/real_match/', { ...this.options, params: params });
  }

  /*
    Method to get Real Matches by flexible parameters from the API
  */
  getRealMatchesByParameters(parameters: { [key: string]: any }): Observable<RealMatch[]> {
    let params = new HttpParams();
    
    // Add each parameter to the query string
    Object.keys(parameters).forEach(key => {
      if (parameters[key] !== null && parameters[key] !== undefined) {
        params = params.set(key, parameters[key].toString());
      }
    });
    
    return this.http.get<RealMatch[]>(this.url + '/real_match/', { ...this.options, params: params });
  }

  /*
    Method to get Real Matches by league and season from the API
  */
  getRealMatchesFinishedByLeagueIDAndSeason(league_id: number, season: number): Observable<RealMatch[]> {
    let params = new HttpParams().set('league_id', league_id).set('season', season).set('finished', 'true');
    return this.http.get<RealMatch[]>(this.url + '/real_match/', { ...this.options, params: params });
  }

  /*
    Method to create a new Match from a Real Match
  */
  createMatch(match: MatchRequest): Observable<Match> {
    return this.http.post<Match>(this.url + '/match/', match, this.options);
  }

  /*
    Method to delete a match by the fixtureId
  */
  deleteMatch(fixtureId: number): Observable<string> {
    return this.http.delete<string>(this.url + '/match/' + fixtureId, this.options);
  }
    
  /*
    Method to get all the Matches by team and season from the API
  */
  getMatchesByTeamIDAndSeason(team_id: number, season: number): Observable<Match[]> {
    let params = new HttpParams().set('team_id', team_id).set('season', season); 
    return this.http.get<Match[]>(this.url + '/match', { ...this.options, params: params });
  }

  /*
    Method to get all the Matches by location id from the API
  */
  getMatchesByLocationID(location_id: string): Observable<Match[]> {
    let params = new HttpParams().set('location', location_id); 
    return this.http.get<Match[]>(this.url + '/match', { ...this.options, params: params });
  }

  /*
    Method to get all the Matches by location id from the API
  */
  getMatches(): Observable<Match[]> {
    return this.http.get<Match[]>(this.url + '/match', { ...this.options });
  }
  
  /*
    Method to set a Location for a Match
  */
  setLocation(fixtureId: number, location: string, venue?: any): Observable<number> {
    let body = {
      fixtureId: fixtureId,
      location: location,
      venue: venue
    }
    return this.http.post<number>(this.url + '/match/set_location', body, this.options);
  }

  /*
    Method to create a new Locatoin
  */
  createLocation(location: any): Observable<number> {
    return this.http.post<number>(this.url + '/location/', location, this.options);
  }

  /*
    Method to get all the Locations from the API
  */
  getLocations(): Observable<Location[]> {
    return this.http.get<Location[]>(this.url + '/location/', this.options);
  }

  /*
    Method to get all the Locations from the API
  */
  getLocationsCounts(): Observable<Location[]> {
    return this.http.get<Location[]>(this.url + '/location/counts/', this.options);
  }

  /*
    Method to get the Leagues Settings from the API for Admin page
  */
  getLeaguesSettings(): Observable<LeaguesSettings[]> {
    return this.http.get<LeaguesSettings[]>(this.url + '/league/settings/', this.options);
  }

  /*
    Method to change the Update Frequency of a League Settings
  */
  changeIsActive(league_id: number, is_active: boolean): Observable<number> {
    let body = {
      league_id: league_id,
      is_active: is_active
    }
    return this.http.patch<number>(this.url + '/admin/leagues_settings/is_active', body, this.options);
  }

  /*
    Method to change the Update Frequency of a League Settings
  */
  changeUpdateFrequency(league_id: number, update_frequency: number): Observable<number> {
    let body = {
      league_id: league_id,
      update_frequency: update_frequency
    }
    return this.http.patch<number>(this.url + '/admin/leagues_settings/update_frequency', body, this.options);
    
  }

  /*
    Method to change the Update Frequency of a League Settings
  */
  changeDailyUpdate(league_id: number, daily_update: boolean): Observable<number> {
    let body = {
      league_id: league_id,
      daily_update: daily_update
    }
    return this.http.patch<number>(this.url + '/admin/leagues_settings/daily_update', body, this.options);
  }
}
