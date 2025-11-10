import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerStatBadgeComponent } from '../player-stat-badge/player-stat-badge.component';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-basic-player-stat-card',
  standalone: true,
  imports: [CommonModule, PlayerStatBadgeComponent, RouterLink],
  templateUrl: './basic-player-stat-card.component.html',
  styleUrls: ['./basic-player-stat-card.component.css']
})
export class BasicPlayerStatCardComponent {
  @Input() playerName!: string;
  @Input() playerId!: number;
  @Input() avatarUrl: string | null = null;
  @Input() badges: Array<{ icon: string; value: number | string }> = [];
}

