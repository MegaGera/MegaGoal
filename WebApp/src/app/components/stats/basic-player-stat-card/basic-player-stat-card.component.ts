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
  /** Optional ranking position for list rows (1-based), or shirt number. */
  @Input() rank: number | null = null;
  /** Override rank label (e.g. `#10`). Falls back to `rank`. */
  @Input() rankDisplay: string | null = null;
  /** When false, shirt/low numbers are not styled as top-3 ranks. */
  @Input() accentTopRanks = true;
  /** Keep watched/goals/assists on the same row on mobile (no wrap below). */
  @Input() statsInlineOnMobile = false;
  /** Mobile list: watched, goals, and assists stay on one row under the player. */
  @Input() singleStatRowOnMobile = false;
  /** Watched appearances — used for row metrics when set. */
  @Input() matchesWatched: number | null = null;
  @Input() goals: number | null = null;
  @Input() assists: number | null = null;
  @Input() nationality: string | null = null;
  @Input() nationalityFlag: string | null = null;
  /** Top watched clubs for this player (player's side only). */
  @Input() teams: PlayerViewedTeam[] = [];
  /** Stronger border to mark watched players in search results. */
  @Input() seen = false;

  private _playerId!: number;
  imageFailed = false;
  private failedTeamLogos = new Set<number>();

  constructor(public images: ImagesService) {}

  get topTeams(): PlayerViewedTeam[] {
    return (this.teams ?? []).slice(0, 3);
  }

  get showRank(): boolean {
    return this.rankDisplay != null || this.rank != null;
  }

  get rankLabel(): string {
    if (this.rankDisplay != null) {
      return this.rankDisplay;
    }
    return this.rank != null ? String(this.rank) : '';
  }

  get showTopRankAccent(): boolean {
    return this.accentTopRanks && this.rank != null && this.rank <= 3;
  }

  get showMatchesBadge(): boolean {
    return this.matchesWatched != null && this.matchesWatched > 0;
  }

  get showGoalsBadge(): boolean {
    return this.goals != null && this.goals > 0;
  }

  get showAssistsBadge(): boolean {
    return this.assists != null && this.assists > 0;
  }

  get showStatBadges(): boolean {
    return this.showMatchesBadge || this.showGoalsBadge || this.showAssistsBadge;
  }

  /** All three metrics present → watched on its own row above goals/assists. */
  get stackStatBadges(): boolean {
    return this.showMatchesBadge && this.showGoalsBadge && this.showAssistsBadge;
  }

  get showGoalsOrAssistsBadge(): boolean {
    return this.showGoalsBadge || this.showAssistsBadge;
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
