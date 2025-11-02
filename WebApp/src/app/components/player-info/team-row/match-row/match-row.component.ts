import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ImagesService } from '../../../../services/images.service';
import { Match } from '../../../../models/match';
import { PlayerStatBadgeComponent } from '../player-stat-badge/player-stat-badge.component';

@Component({
  selector: 'app-match-row',
  standalone: true,
  imports: [CommonModule, RouterLink, PlayerStatBadgeComponent],
  templateUrl: './match-row.component.html',
  styleUrl: './match-row.component.css'
})
export class MatchRowComponent {
  @Input() match!: Match;

  constructor(public images: ImagesService) {}

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = 'assets/img/default-player.png';
    }
  }

  formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  hasPlayerStats(): boolean {
    return this.match.player_stats !== undefined;
  }

  hasGoals(): boolean {
    return this.match.player_stats !== undefined && this.match.player_stats.goals > 0;
  }

  hasAssists(): boolean {
    return this.match.player_stats !== undefined && this.match.player_stats.assists > 0;
  }

  hasYellowCards(): boolean {
    return this.match.player_stats !== undefined && this.match.player_stats.yellow_cards > 0;
  }

  hasRedCards(): boolean {
    return this.match.player_stats !== undefined && this.match.player_stats.red_cards > 0;
  }

  started(): boolean {
    return this.match.player_stats !== undefined && this.match.player_stats.started;
  }
}

