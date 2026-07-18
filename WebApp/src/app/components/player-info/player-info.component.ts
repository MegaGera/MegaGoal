/* 
  Player Info component to display detailed information about a specific player
*/

import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { StatsService } from '../../services/stats.service';
import { Player } from '../../models/player';
import { PlayerStats } from '../../models/playerStats';
import { Team } from '../../models/team';
import { TeamRowComponent } from './team-row/team-row.component';
import { PlayerHeaderComponent } from './player-header/player-header.component';
import { BasicStatCardComponent } from '../stats/basic-stat-card/basic-stat-card.component';
import { GeneralCardComponent } from '../general-card/general-card.component';

@Component({
  selector: 'app-player-info',
  standalone: true,
  imports: [CommonModule, TeamRowComponent, BasicStatCardComponent, PlayerHeaderComponent, GeneralCardComponent],
  templateUrl: './player-info.component.html',
  styleUrl: './player-info.component.css',
  providers: [ImagesService]
})
export class PlayerInfoComponent {

  queryPlayerId!: number;
  player!: Player;
  playerStats?: PlayerStats;
  loading: boolean = true;
  statsLoading: boolean = true;
  
  teamsSeasonsList: any[] = [];
  playerAge: number | null = null;
  playerBirthPlace: string | null = null;

  /**
   * Full Team docs for every club that shares the player's latest season year.
   * Kept for a future “last match played” picker; selection uses {@link currentClub} only.
   */
  currentSeasonTeams: Team[] = [];
  /** Preferred club for the header (non-national if possible, else first). */
  currentClub: Team | null = null;

  constructor(
    private megagoal: MegaGoalService, 
    private router: Router, 
    private activatedRoute: ActivatedRoute,
    private statsService: StatsService
  ) {
    this.activatedRoute.queryParamMap.subscribe(params => {
      this.queryPlayerId = +params.get('id')! || 0;
      this.init();
    });
  }

  init() {
    this.loading = true;
    this.statsLoading = true;
    this.currentSeasonTeams = [];
    this.currentClub = null;
    
    this.megagoal.getPlayerById(this.queryPlayerId).subscribe(result => {
      if (result != undefined) {
        this.player = result;
        this.playerAge = this.calculatePlayerAge(this.player.player?.birth?.date);
        this.playerBirthPlace = this.buildBirthPlace(this.player.player?.birth);
        this.loading = false;
        this.loadPlayerStats();
        this.loadCurrentSeasonTeams();
        
        // Log page visit with player information
        this.megagoal.logPageVisit('player-info', {
          playerId: this.player.player.id,
          playerName: this.player.player.name
        }).subscribe({
          next: () => {},
          error: (error) => console.error('Error logging page visit:', error)
        });
      } else {
        this.router.navigate(["/app/home"]);
      }
    }, error => {
      console.error('Error loading player:', error);
      this.router.navigate(["/app/home"]);
    });
  }

  loadPlayerStats() {
    this.statsService.getPlayerStats(this.queryPlayerId).subscribe(result => {
      this.playerStats = result;
      this.statsLoading = false;
      this.updateTeamsSeasonsList();
    }, error => {
      console.error('Error loading player stats:', error);
      this.statsLoading = false;
    });
  }

  /**
   * Teams whose seasons include the max year on the player doc; fetch full Team payloads.
   */
  private loadCurrentSeasonTeams(): void {
    this.currentSeasonTeams = [];
    this.currentClub = null;

    const history = this.player?.teams;
    if (!Array.isArray(history) || history.length === 0) {
      return;
    }

    let maxSeason = -Infinity;
    for (const entry of history) {
      for (const season of entry.seasons ?? []) {
        const y = Number(season);
        if (!Number.isNaN(y)) {
          maxSeason = Math.max(maxSeason, y);
        }
      }
    }
    if (maxSeason === -Infinity) {
      return;
    }

    const candidateIds = history
      .filter((entry) =>
        (entry.seasons ?? []).some((s: number) => Number(s) === maxSeason)
      )
      .map((entry) => entry.team.id as number)
      .filter((id, index, arr) => id != null && arr.indexOf(id) === index);

    if (candidateIds.length === 0) {
      return;
    }

    forkJoin(
      candidateIds.map((id) =>
        this.megagoal.getTeamById(id).pipe(
          catchError((err) => {
            console.error(`Error fetching team ${id} for player header:`, err);
            return of(null);
          })
        )
      )
    ).subscribe((results) => {
      const teams = results.filter((t): t is Team => t != null && t.team?.id != null);
      this.currentSeasonTeams = teams;
      this.currentClub = this.pickCurrentClub(teams);
    });
  }

  /** Prefer a club side over a national team; otherwise first entry. */
  private pickCurrentClub(teams: Team[]): Team | null {
    if (teams.length === 0) {
      return null;
    }
    const clubSide = teams.find((t) => t.team?.national === false);
    return clubSide ?? teams[0];
  }
  
  updateTeamsSeasonsList(): void {
    if (!this.hasTeams() || !this.player.teams || !this.playerStats) return;
    
    const flatList: any[] = [];
    
    this.player.teams.forEach((teamData: any) => {
      if (teamData.seasons && Array.isArray(teamData.seasons)) {
        teamData.seasons.forEach((season: number) => {
          const teamStats = this.getTeamStats(teamData.team.id, season);
          flatList.push({ team: teamData, season, teamStats });
        });
      }
    });
    
    this.teamsSeasonsList = flatList.sort((a, b) => b.season - a.season);
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  private calculatePlayerAge(birthDateString?: string | null): number | null {
    if (!birthDateString) return null;

    const birthDate = new Date(birthDateString);
    if (isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();

    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age >= 0 ? age : null;
  }

  private buildBirthPlace(birth?: { place?: string | null; country?: string | null } | null): string | null {
    if (!birth) return null;

    const parts = [birth.place, birth.country].filter((value): value is string => !!value?.trim());
    return parts.length ? parts.join(', ') : null;
  }

  hasTeams(): boolean {
    return Array.isArray(this.player?.teams) && this.player.teams.length > 0;
  }

  getTeamsAndSeasonsFlat(): any[] {
    return this.teamsSeasonsList;
  }
  
  getTeamStats(teamId: number, season: number): any {
    if (!this.playerStats?.seasons) return undefined;
    
    // Find the season data
    const seasonData = this.playerStats.seasons.find(s => s.season === season);
    if (!seasonData) return undefined;
    
    // Find the team in that season
    return seasonData.teams.find(t => t.team_id === teamId);
  }
  
}
