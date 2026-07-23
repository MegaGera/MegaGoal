import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserStats } from '../models/userStats';
import { FavouriteTeamStats } from '../models/favouriteTeamStats';
import { GeneralStats } from '../models/generalStats';
import { PlayerStats, PlayerCareerStats, PlayerTeamSeasonMatchesResponse } from '../models/playerStats';
import { PlayerViewedStats } from '../models/playerViewedStats';

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

  private withTeamsParams(
    params: HttpParams,
    teams?: number[],
    teamsAgainst?: number[]
  ): HttpParams {
    if (teams?.length) {
      params = params.set('teams', teams.join(','));
    }
    if (teamsAgainst?.length) {
      params = params.set('teams_against', teamsAgainst.join(','));
    }
    return params;
  }

  /*
    Method to get stats of the teams viewed from the API
  */
  getTeamsViewed(
    teamSelection: number,
    leagues: number[],
    season: number,
    location: string = '',
    teams?: number[],
    teamsAgainst?: number[]
  ): Observable<any[]> {
    let params = new HttpParams()
    .set('team_selection', teamSelection)
    .set('leagues', leagues.toString())
    .set('season', season);
    
    if (location) {
      params = params.set('location', location);
    }
    params = this.withTeamsParams(params, teams, teamsAgainst);
    
    return this.http.get<any[]>(this.url + '/teams-viewed/', { ...this.options, params: params });
  }

  /*
    Players ranked by watched appearances (startXI or sub), same filters as teams-viewed
  */
  getPlayersViewed(
    teamSelection: number,
    leagues: number[],
    season: number,
    location: string = '',
    teams?: number[],
    teamsAgainst?: number[]
  ): Observable<PlayerViewedStats[]> {
    let params = new HttpParams()
      .set('team_selection', teamSelection)
      .set('leagues', leagues.toString())
      .set('season', season);

    if (location) {
      params = params.set('location', location);
    }
    params = this.withTeamsParams(params, teams, teamsAgainst);

    return this.http.get<PlayerViewedStats[]>(this.url + '/players-viewed/', {
      ...this.options,
      params,
    });
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
    Method to get general statistics for a specific team
  */
  getTeamGeneralStats(teamId: number): Observable<UserStats> {
    const params = new HttpParams().set('team_id', teamId.toString());
    return this.http.get<UserStats>(this.url + '/team-general-stats/', { ...this.options, params });
  }

  /*
    Method to get favourite team statistics based on current filters
  */
  getFavouriteTeamStats(
    team_id: number,
    filterLeagueSelected: number[],
    filterSeasonSelected: number,
    location: string = '',
    teams?: number[],
    teamsAgainst?: number[]
  ): Observable<FavouriteTeamStats> {
    let params = new HttpParams()
      .set('team_id', team_id.toString())
      .set('leagues', filterLeagueSelected.join(','))
      .set('season', filterSeasonSelected.toString());
    
    if (location) {
      params = params.set('location', location);
    }
    params = this.withTeamsParams(params, teams, teamsAgainst);
    
    return this.http.get<FavouriteTeamStats>(this.url + '/favourite-team-stats/', { ...this.options, params: params });
  }

  /*
    Method to get general statistics based on current filters
  */
  getGeneralStats(
    teamSelection: number,
    filterLeagueSelected: number[],
    filterSeasonSelected: number,
    location: string = '',
    teams?: number[],
    teamsAgainst?: number[]
  ): Observable<GeneralStats> {
    let params = new HttpParams()
      .set('team_selection', teamSelection)
      .set('leagues', filterLeagueSelected.join(','))
      .set('season', filterSeasonSelected.toString());
    
    if (location) {
      params = params.set('location', location);
    }
    params = this.withTeamsParams(params, teams, teamsAgainst);
    
    return this.http.get<GeneralStats>(this.url + '/general-stats/', { ...this.options, params: params });
  }

  /*
    Method to get landing page team statistics (demo data for team 541)
  */
  getLandingPageTeamStats(): Observable<FavouriteTeamStats> {
    return this.http.get<FavouriteTeamStats>(this.url + '/landing-page-team-stats/', this.options);
  }

  /*
    Method to get player statistics based on matches viewed by user
  */
  getPlayerStats(playerId: number): Observable<PlayerStats> {
    let params = new HttpParams().set('player_id', playerId.toString());
    return this.http.get<PlayerStats>(this.url + '/player-stats/', { ...this.options, params: params });
  }

  /** Career aggregates per season/team (all appearances in real_matches). */
  getPlayerCareerStats(playerId: number): Observable<PlayerCareerStats> {
    const params = new HttpParams().set('player_id', playerId.toString());
    return this.http.get<PlayerCareerStats>(this.url + '/player-career-stats/', {
      ...this.options,
      params
    });
  }

  /** Lazy match list for one player + team + season (watched flag included). */
  getPlayerTeamSeasonMatches(
    playerId: number,
    teamId: number,
    season: number
  ): Observable<PlayerTeamSeasonMatchesResponse> {
    const params = new HttpParams()
      .set('player_id', playerId.toString())
      .set('team_id', teamId.toString())
      .set('season', season.toString());
    return this.http.get<PlayerTeamSeasonMatchesResponse>(
      this.url + '/player-team-season-matches/',
      { ...this.options, params }
    );
  }

  /*
    Method to get general statistics for a specific player
  */
  getPlayerGeneralStats(playerId: number): Observable<UserStats> {
    const params = new HttpParams().set('player_id', playerId.toString());
    return this.http.get<UserStats>(this.url + '/player-general-stats/', { ...this.options, params });
  }

}
