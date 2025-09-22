import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserStats } from '../models/userStats';
import { FavouriteTeamStats } from '../models/favouriteTeamStats';
import { GeneralStats } from '../models/generalStats';

@Injectable({
  providedIn: 'root'
})
export class StatsService {

  /*
    URL of the API server
  */
  url = environment.serverStatsURL + "/api";
  options = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: environment.production ? true : false
  }
    
  constructor(private http: HttpClient) { }

  /*
    Method to get stats of the teams viewed from the API
  */
  getTeamsViewed(teamSelection: number, leagues: number[], season: number, location: string = ''): Observable<any[]> {
    let params = new HttpParams()
    .set('team_selection', teamSelection)
    .set('leagues', leagues.toString())
    .set('season', season);
    
    if (location) {
      params = params.set('location', location);
    }
    
    return this.http.get<any[]>(this.url + '/teams-viewed/', { ...this.options, params: params });
  }

  /*
    Method to get stats of the leagues viewed from the API
  */
  getLeaguesViewed(): Observable<any[]> {
    return this.http.get<any[]>(this.url + '/leagues-viewed/', { ...this.options });
  }

  /*
    Method to get general user statistics for the hero section
  */
  getUserGeneralStats(): Observable<UserStats> {
    return this.http.get<UserStats>(this.url + '/user-general-stats/', this.options);
  }

  /*
    Method to get favourite team statistics based on current filters
  */
  getFavouriteTeamStats(
    team_id: number,
    filterLeagueSelected: number[],
    filterSeasonSelected: number,
    location: string = ''
  ): Observable<FavouriteTeamStats> {
    let params = new HttpParams()
      .set('team_id', team_id.toString())
      .set('leagues', filterLeagueSelected.join(','))
      .set('season', filterSeasonSelected.toString());
    
    if (location) {
      params = params.set('location', location);
    }
    
    return this.http.get<FavouriteTeamStats>(this.url + '/favourite-team-stats/', { ...this.options, params: params });
  }

  /*
    Method to get general statistics based on current filters
  */
  getGeneralStats(
    teamSelection: number,
    filterLeagueSelected: number[],
    filterSeasonSelected: number,
    location: string = ''
  ): Observable<GeneralStats> {
    let params = new HttpParams()
      .set('team_selection', teamSelection)
      .set('leagues', filterLeagueSelected.join(','))
      .set('season', filterSeasonSelected.toString());
    
    if (location) {
      params = params.set('location', location);
    }
    
    return this.http.get<GeneralStats>(this.url + '/general-stats/', { ...this.options, params: params });
  }

  /*
    Method to get landing page team statistics (demo data for team 541)
  */
  getLandingPageTeamStats(): Observable<FavouriteTeamStats> {
    return this.http.get<FavouriteTeamStats>(this.url + '/landing-page-team-stats/', this.options);
  }

}
