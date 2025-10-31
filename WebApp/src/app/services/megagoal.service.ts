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
import { UserFeedback } from '../models/user_feedback';
import { Player } from '../models/player';

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
    Method to get a Real Match by ID from the API
  */
  getRealMatchById(match_id: number): Observable<RealMatch> {
    return this.http.get<RealMatch>(this.url + '/real_match/' + match_id, this.options);
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
    Method to get Real Matches by date from the API
  */
  getRealMatchesByDate(date: string): Observable<RealMatch[]> {
    let params = new HttpParams().set('date', date);
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
    Method to get all the Matches by fixture id from the API
  */
  getMatchesByFixtureId(fixture_id: number): Observable<Match[]> {
    let params = new HttpParams().set('fixture_id', fixture_id); 
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

  /*
    Method to submit user feedback
  */
  submitFeedback(feedback: UserFeedback): Observable<UserFeedback> {
    return this.http.post<UserFeedback>(this.url + '/feedback/', feedback, this.options);
  }

  /*
    Method to create a new league setting
  */
  createLeagueSetting(league_id: number, league_name: string): Observable<any> {
    let body = {
      league_id: league_id,
      league_name: league_name
    }
    return this.http.post<any>(this.url + '/admin/leagues_settings/create', body, this.options);
  }

  /*
    Method to get real matches without statistics that have been marked by users
  */
  getRealMatchesWithoutStatistics(page: number = 1): Observable<{ matches: RealMatch[], total: number, page: number, totalPages: number }> {
    let params = new HttpParams().set('page', page.toString());
    return this.http.get<{ matches: RealMatch[], total: number, page: number, totalPages: number }>(
      this.url + '/admin/real_matches/without_statistics', 
      { ...this.options, params: params }
    );
  }

  /*
    Method to add a match to landing page matches
  */
  addLandingMatch(fixture_id: number): Observable<any> {
    let body = { fixture_id: fixture_id };
    return this.http.post<any>(this.url + '/admin/landing_matches/add', body, this.options);
  }

  /*
    Method to remove a match from landing page matches
  */
  removeLandingMatch(fixture_id: number): Observable<any> {
    let body = { fixture_id: fixture_id };
    return this.http.request<any>('delete', this.url + '/admin/landing_matches/remove', { ...this.options, body: body });
  }

  /*
    Method to get landing page matches
  */
  getLandingMatches(): Observable<RealMatch[]> {
    return this.http.get<RealMatch[]>(this.url + '/admin/landing_matches', this.options);
  }

  /**
   * Get players from database with search and pagination
   */
  getPlayers(page: number = 1, limit: number = 50, search: string = '', position: string = '', nationality: string = '', teamsFilter: string = ''): Observable<any> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('search', search)
      .set('position', position)
      .set('nationality', nationality)
      .set('teams_filter', teamsFilter);
    
    return this.http.get<any>(this.url + '/players/', { ...this.options, params });
  }

  /**
   * Get players API info from settings
   */
  getPlayersApiInfo(): Observable<any> {
    return this.http.get<any>(this.url + '/players/players-api-info/', this.options);
  }

  /**
   * Get player by ID
   */
  getPlayerById(playerId: number): Observable<Player> {
    return this.http.get<Player>(this.url + '/players/' + playerId, this.options);
  }
}
