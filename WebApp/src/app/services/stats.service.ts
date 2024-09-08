import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StatsService {

  /*
    URL of the API server
  */
  url = environment.serverStatsURL + ":" + environment.serverStatsPort + "/api";
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
  getTeamsViewed(teamSelection: number, leagues: number[], season: number): Observable<any[]> {
    let params = new HttpParams()
    .set('team_selection', teamSelection)
    .set('leagues', leagues.toString())
    .set('season', season);
    return this.http.get<any[]>(this.url + '/teams-viewed/', { ...this.options, params: params });
  }

  /*
    Method to get stats of the leagues viewed from the API
  */
  getLeaguesViewed(username: string): Observable<any[]> {
    let params = new HttpParams().set('username', username); 
    return this.http.get<any[]>(this.url + '/leagues-viewed/', { ...this.options, params: params });
  }

}
