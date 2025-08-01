import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UpdaterService {
  url = environment.serverUpdaterURL;
  options = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: environment.production ? true : false
  };

  constructor(private http: HttpClient) { }

  /**
   * Trigger update of matches for a league and season
   */
  updateMatches(league_id: number, season: number): Observable<any> {
    return this.http.post<any>(
      this.url + '/update_matches/',
      { league_id, season },
      this.options
    );
  }

  /**
   * Update the season value for a league
   */
  updateLeagueSeason(league_id: number, season: number): Observable<any> {
    return this.http.post<any>(
      this.url + '/update_league_current_season/',
      { league_id, season },
      this.options
    );
  }

  /**
   * Trigger update of all leagues
   */
  updateLeagues(): Observable<any> {
    return this.http.post<any>(
      this.url + '/update_leagues/',
      {},
      this.options
    );
  }

  /**
   * Check and update available seasons for all leagues
   */
  checkAvailableSeasons(): Observable<any> {
    return this.http.post<any>(
      this.url + '/check_available_seasons/',
      {},
      this.options
    );
  }

  /**
   * Add teams for a league and season
   */
  updateTeams(league_id: number, season: number): Observable<any> {
    return this.http.post<any>(
      this.url + '/update_teams/',
      { league_id, season },
      this.options
    );
  }
} 