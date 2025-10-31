/* 
  Player Info component to display detailed information about a specific player
*/

import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { StatsService } from '../../services/stats.service';
import { Player } from '../../models/player';
import { PlayerStats } from '../../models/playerStats';

@Component({
  selector: 'app-player-info',
  standalone: true,
  imports: [CommonModule],
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

  constructor(
    private megagoal: MegaGoalService, 
    private router: Router, 
    public images: ImagesService,
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
    
    this.megagoal.getPlayerById(this.queryPlayerId).subscribe(result => {
      if (result != undefined) {
        this.player = result;
        this.loading = false;
        this.loadPlayerStats();
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
    }, error => {
      console.error('Error loading player stats:', error);
      this.statsLoading = false;
    });
  }

  getPlayerImageUrl(): string {
    return this.images.getRouteImagePlayer(this.player.player.id);
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = 'assets/img/default-player.png';
    }
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  hasTeams(): boolean {
    return Array.isArray(this.player?.teams) && this.player.teams.length > 0;
  }

  getTeamsGroupedByTeam(): any[] {
    if (!this.hasTeams()) return [];
    return this.player.teams || [];
  }

  sortSeasons(seasons: number[]): number[] {
    return seasons.sort((a, b) => b - a); // Sort descending (newest first)
  }
}

