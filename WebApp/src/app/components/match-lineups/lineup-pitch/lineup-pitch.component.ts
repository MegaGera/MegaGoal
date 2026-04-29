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
  @Input() assistCountsByPlayerId: Record<number, number> = {};
  @Input() yellowCardCountsByPlayerId: Record<number, number> = {};
  @Input() redCardCountsByPlayerId: Record<number, number> = {};
  @Input() substitutedOutPlayerIds: number[] = [];
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

  getAssistIconIndexes(playerId: number): number[] {
    const count = this.assistCountsByPlayerId[playerId] || 0;
    const visibleCount = Math.min(3, count);
    return Array.from({ length: visibleCount }, (_, index) => index);
  }

  /** Red overrides yellow (same player): show only red stack. */
  getCardIconIndexes(playerId: number): number[] {
    const redCount = this.redCardCountsByPlayerId[playerId] || 0;
    if (redCount > 0) {
      const visibleCount = Math.min(3, redCount);
      return Array.from({ length: visibleCount }, (_, index) => index);
    }

    const yellowCount = this.yellowCardCountsByPlayerId[playerId] || 0;
    const visibleCount = Math.min(3, yellowCount);
    return Array.from({ length: visibleCount }, (_, index) => index);
  }

  getCardEmoji(playerId: number): string {
    const redCount = this.redCardCountsByPlayerId[playerId] || 0;
    return redCount > 0 ? '🟥' : '🟨';
  }

  getCardStackHeightPx(playerId: number): number {
    return this.getStackHeightPx(this.getCardIconIndexes(playerId).length);
  }

  getCardTitle(playerId: number): string {
    const redCount = this.redCardCountsByPlayerId[playerId] || 0;
    return redCount > 0 ? 'Red card' : 'Yellow card';
  }

  showCardStack(playerId: number): boolean {
    return this.getCardIconIndexes(playerId).length > 0;
  }

  hasSubstitution(playerId: number): boolean {
    return this.substitutedOutPlayerIds.includes(playerId);
  }

  showLeftCornerStats(playerId: number): boolean {
    return this.showCardStack(playerId) || this.hasSubstitution(playerId);
  }

  showRightCornerStats(playerId: number): boolean {
    return this.getGoalIconIndexes(playerId).length > 0 || this.getAssistIconIndexes(playerId).length > 0;
  }

  /** Vertical footprint for stacked icons (matches CSS step of 6px between layers). */
  getStackHeightPx(layerCount: number): number {
    if (layerCount <= 0) {
      return 0;
    }
    return 18 + (layerCount - 1) * 6;
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
