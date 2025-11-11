import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { PlayerStatBadgeComponent } from '../stats/player-stat-badge/player-stat-badge.component';

@Component({
  selector: 'app-team-card',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, PlayerStatBadgeComponent],
  templateUrl: './team-card.component.html',
  styleUrls: ['./team-card.component.css']
})
export class TeamCardComponent {
  @Input() entityType: 'team' | 'player' = 'team';

  // Team specific inputs
  @Input() teamId?: number;
  @Input() teamName?: string;
  @Input() logoUrl?: string;
  @Input() matchesWatched?: number;
  @Input() showMatchesBadge: boolean = true;

  // Player specific inputs
  @Input() playerId?: number;
  @Input() playerName?: string;
  @Input() playerAvatarUrl?: string;
  @Input() playerBadges: Array<{ icon: string; value: number | string }> = [];

  @Input() ariaLabel?: string;

  get isTeam(): boolean {
    return this.entityType === 'team';
  }

  get isPlayer(): boolean {
    return this.entityType === 'player';
  }

  get queryParams(): Record<string, number | string> {
    if (this.isPlayer && this.playerId !== undefined) {
      return { id: this.playerId };
    }

    if (this.isTeam && this.teamId !== undefined) {
      return { id: this.teamId };
    }

    return {};
  }

  get routerLink(): string {
    return this.isPlayer ? '/app/player' : '/app/team';
  }

  get computedAriaLabel(): string {
    if (this.ariaLabel) {
      return this.ariaLabel;
    }

    if (this.isPlayer && this.playerName) {
      return `View ${this.playerName} player details`;
    }

    if (this.isTeam && this.teamName) {
      return `View ${this.teamName} team details`;
    }

    return 'View details';
  }
}


