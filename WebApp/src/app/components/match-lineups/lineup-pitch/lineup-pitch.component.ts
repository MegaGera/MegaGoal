import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ImagesService } from '../../../services/images.service';

interface PitchPlayer {
  id: number;
  name: string;
  number: number;
}

interface PitchRowEntry {
  row: number;
  col: number;
  player: PitchPlayer;
}

@Component({
  selector: 'app-lineup-pitch',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './lineup-pitch.component.html',
  styleUrl: './lineup-pitch.component.css'
})
export class LineupPitchComponent {
  @Input() rows: PitchRowEntry[][] = [];
  @Input() goalCountsByPlayerId: Record<number, number> = {};
  /** When true, renders only player rows for placement inside a parent dual-half pitch (no grass/markings). */
  @Input() embedded = false;

  constructor(private images: ImagesService) {}

  getPlayerImageUrl(playerId: number): string {
    return this.images.getRouteImagePlayer(playerId);
  }

  getGoalIconIndexes(playerId: number): number[] {
    const count = this.goalCountsByPlayerId[playerId] || 0;
    const visibleCount = Math.min(3, count);
    return Array.from({ length: visibleCount }, (_, index) => index);
  }

  onPlayerImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (!target) {
      return;
    }

    if (target.src.includes('data:image')) {
      target.style.display = 'none';
      return;
    }

    target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22%23e5e7eb%22/%3E%3C/svg%3E';
  }
}
