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

  /**
   * Move league position up or down
   */
  moveLeaguePosition(league_id: number, direction: 'up' | 'down'): Observable<any> {
    return this.http.post<any>(
      this.url + '/move_league_position/',
      { league_id, direction },
      this.options
    );
  }

  /**
   * Change league to a specific position
   */
  changeLeaguePosition(league_id: number, new_position: number): Observable<any> {
    return this.http.post<any>(
      this.url + '/change_league_position/',
      { league_id, new_position },
      this.options
    );
  }

  /**
   * Update statistics for a specific fixture
   */
  updateMatchStatistics(fixture_id: number): Observable<any> {
    return this.http.post<any>(
      this.url + '/update_match_statistics/',
      { fixture_id },
      this.options
    );
  }

  /**
   * Update lineups for a specific fixture
   */
  updateMatchLineups(fixture_id: number): Observable<any> {
    return this.http.post<any>(
      this.url + '/update_match_lineups/',
      { fixture_id },
      this.options
    );
  }

  /**
   * Update events for a specific fixture
   */
  updateMatchEvents(fixture_id: number): Observable<any> {
    return this.http.post<any>(
      this.url + '/update_match_events/',
      { fixture_id },
      this.options
    );
  }

  /**
   * Update players for a specific page
   */
  updatePlayers(page: number): Observable<any> {
    return this.http.post<any>(
      this.url + '/update_players/',
      { page },
      this.options
    );
  }

  /**
   * Update teams for a specific player
   */
  updatePlayerTeams(player_id: number): Observable<any> {
    return this.http.post<any>(
      this.url + '/update_player_teams/',
      { player_id },
      this.options
    );
  }

  /**
   * Update players for a league and season
   */
  updateLeaguePlayers(league_id: number, season: number): Observable<any> {
    return this.http.post<any>(
      this.url + '/update_league_players/',
      { league_id, season },
      this.options
    );
  }

  /**
   * Update lineups for a league and season
   */
  updateLeagueLineups(league_id: number, season: number): Observable<any> {
    return this.http.post<any>(
      this.url + '/update_league_lineups/',
      { league_id, season },
      this.options
    );
  }

  /**
   * Update events for a league and season
   */
  updateLeagueEvents(league_id: number, season: number): Observable<any> {
    return this.http.post<any>(
      this.url + '/update_league_events/',
      { league_id, season },
      this.options
    );
  }

  /**
   * Update statistics for a league and season (full)
   */
  updateLeagueStatistics(league_id: number, season: number): Observable<any> {
    return this.http.post<any>(
      this.url + '/update_league_statistics/',
      { league_id, season },
      this.options
    );
  }

  /**
   * Update statistics for a league and season (missing only)
   */
  updateLeagueStatisticsMissing(league_id: number, season: number): Observable<any> {
    return this.http.post<any>(
      this.url + '/update_league_statistics_missing/',
      { league_id, season },
      this.options
    );
  }

  /**
   * Update lineups for a league and season (missing only)
   */
  updateLeagueLineupsMissing(league_id: number, season: number): Observable<any> {
    return this.http.post<any>(
      this.url + '/update_league_lineups_missing/',
      { league_id, season },
      this.options
    );
  }

  /**
   * Update events for a league and season (missing only)
   */
  updateLeagueEventsMissing(league_id: number, season: number): Observable<any> {
    return this.http.post<any>(
      this.url + '/update_league_events_missing/',
      { league_id, season },
      this.options
    );
  }

  /**
   * Multi-season update for a league
   */
  multiSeasonUpdate(league_id: number, season_from: number, season_to: number, options: any): Observable<any> {
    return this.http.post<any>(
      this.url + '/multi_season_update/',
      { 
        league_id, 
        season_from, 
        season_to,
        update_matches: options.matches,
        update_teams: options.teams,
        update_players: options.players,
        update_statistics: options.statistics,
        update_statistics_missing: options.statistics_missing,
        update_lineups: options.lineups,
        update_lineups_missing: options.lineups_missing,
        update_events: options.events,
        update_events_missing: options.events_missing
      },
      this.options
    );
  }
} 