import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerStatBadgeComponent } from '../player-stat-badge/player-stat-badge.component';
import { RouterLink } from '@angular/router';
import { ImagesService } from '../../../services/images.service';
import { PlayerViewedTeam } from '../../../models/playerViewedStats';

@Component({
  selector: 'app-basic-player-stat-card',
  standalone: true,
  imports: [CommonModule, PlayerStatBadgeComponent, RouterLink],
  templateUrl: './basic-player-stat-card.component.html',
  styleUrls: ['./basic-player-stat-card.component.css'],
  providers: [ImagesService],
})
export class BasicPlayerStatCardComponent {
  @Input() playerName!: string;
  @Input() set playerId(value: number) {
    this._playerId = value;
    this.imageFailed = false;
  }
  get playerId(): number {
    return this._playerId;
  }
  @Input() avatarUrl: string | null = null;
  @Input() badges: Array<{ icon: string; value: number | string }> = [];
  /** `tile` = compact grid card; `row` = full-width list row (players page). */
  @Input() variant: 'tile' | 'row' = 'tile';
  /** Optional ranking position for list rows (1-based). */
  @Input() rank: number | null = null;
  /** Watched appearances — used for row metrics when set. */
  @Input() matchesWatched: number | null = null;
  @Input() goals: number | null = null;
  @Input() assists: number | null = null;
  @Input() nationality: string | null = null;
  @Input() nationalityFlag: string | null = null;
  /** Top watched clubs for this player (player's side only). */
  @Input() teams: PlayerViewedTeam[] = [];

  private _playerId!: number;
  imageFailed = false;
  private failedTeamLogos = new Set<number>();

  constructor(public images: ImagesService) {}

  get topTeams(): PlayerViewedTeam[] {
    return (this.teams ?? []).slice(0, 3);
  }

  onImageError(): void {
    this.imageFailed = true;
  }

  teamLogoUrl(teamId: number): string {
    return this.images.getRouteImageTeam(teamId);
  }

  onTeamLogoError(teamId: number): void {
    this.failedTeamLogos.add(teamId);
  }

  teamLogoFailed(teamId: number): boolean {
    return this.failedTeamLogos.has(teamId);
  }
}
