import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';

import { Player } from '../../../models/player';
import { ImagesService } from '../../../services/images.service';
import { StatsService } from '../../../services/stats.service';
import { UserStats } from '../../../models/userStats';
import { QuickStatsComponent } from '../../stats/quick-stats/quick-stats.component';

@Component({
  selector: 'app-player-header',
  standalone: true,
  imports: [CommonModule, QuickStatsComponent],
  templateUrl: './player-header.component.html',
  styleUrl: './player-header.component.css',
  providers: [ImagesService]
})
export class PlayerHeaderComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) player!: Player;
  @Input() playerAge: number | null = null;
  @Input() playerBirthPlace: string | null = null;

  playerGeneralStats: UserStats | null = null;
  playerGeneralStatsLoaded = false;

  private playerStatsSubscription?: Subscription;

  constructor(public images: ImagesService, private statsService: StatsService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['player'] && this.player?.player?.id) {
      this.loadPlayerGeneralStats(this.player.player.id);
    }
  }

  ngOnDestroy(): void {
    this.playerStatsSubscription?.unsubscribe();
  }

  private loadPlayerGeneralStats(playerId: number): void {
    this.playerGeneralStatsLoaded = false;
    this.playerStatsSubscription?.unsubscribe();
    this.playerStatsSubscription = this.statsService.getPlayerGeneralStats(playerId).subscribe({
      next: (stats: UserStats) => {
        this.playerGeneralStats = stats;
        this.playerGeneralStatsLoaded = true;
      },
      error: (error: any) => {
        console.error('Error fetching player general stats:', error);
        this.playerGeneralStats = null;
        this.playerGeneralStatsLoaded = true;
      }
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

  hasBasicInfo(): boolean {
    return !!(this.player?.player?.position || this.player?.player?.number);
  }

  hasMetaInfo(): boolean {
    return !!(
      this.player?.player?.nationality ||
      this.playerBirthPlace ||
      this.playerAge !== null
    );
  }
}

