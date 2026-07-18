import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { Player } from '../../../models/player';
import { Team } from '../../../models/team';
import { ImagesService } from '../../../services/images.service';
import { StatsService } from '../../../services/stats.service';
import { UserStats } from '../../../models/userStats';
import { QuickStatsComponent } from '../../stats/quick-stats/quick-stats.component';

@Component({
  selector: 'app-player-header',
  standalone: true,
  imports: [CommonModule, QuickStatsComponent, RouterLink],
  templateUrl: './player-header.component.html',
  styleUrl: './player-header.component.css',
  providers: [ImagesService]
})
export class PlayerHeaderComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) player!: Player;
  @Input() playerAge: number | null = null;
  @Input() playerBirthPlace: string | null = null;
  /** Selected current club (domestic league + flag come from this). */
  @Input() currentClub: Team | null = null;

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

  /** Corner nation badge label from player nationality. */
  get badgeCountryName(): string {
    return this.player?.player?.nationality?.trim() ?? '';
  }

  /** Flag from nationality_country (countries collection), not club league. */
  get badgeCountryFlag(): string | null {
    const url = this.player?.nationality_country?.flag?.trim();
    return url ? url : null;
  }

  get currentClubId(): number | null {
    const id = this.currentClub?.team?.id;
    return id != null && id > 0 ? id : null;
  }

  get currentClubName(): string | null {
    const n = this.currentClub?.team?.name?.trim();
    return n || null;
  }

  /** League colors tint the header chrome (no per-team colors in the API). */
  get leagueAccentBorderColor(): string {
    const c = this.currentClub?.domestic_league?.colors;
    const raw =
      c?.base_color?.trim() ||
      c?.card_main_color?.trim() ||
      c?.card_trans_color?.trim();
    if (raw) return raw;
    return '#94a3b8';
  }

  leagueAccentRgba(alpha: number): string {
    const hex = this.leagueAccentBorderColor.replace(/^#/, '').trim();
    let r: number;
    let g: number;
    let b: number;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      r = 148;
      g = 163;
      b = 184;
    }
    if ([r, g, b].some((n) => Number.isNaN(n))) {
      r = 148;
      g = 163;
      b = 184;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
    return !!(this.playerBirthPlace || this.playerAge !== null);
  }
}
