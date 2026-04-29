import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-player-item',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './player-item.component.html',
  styleUrl: './player-item.component.css'
})
export class PlayerItemComponent {
  @Input() player!: {
    id: number;
    name: string;
    number: number;
    pos: string;
    grid: string | null;
  };
  @Input() isSubstitute: boolean = false;

  /** Match event aggregates (bench rows only use these for inline icons). */
  @Input() goalCountsByPlayerId: Record<number, number> = {};
  @Input() assistCountsByPlayerId: Record<number, number> = {};
  @Input() yellowCardCountsByPlayerId: Record<number, number> = {};
  @Input() redCardCountsByPlayerId: Record<number, number> = {};
  @Input() substitutedInPlayerIds: number[] = [];

  getPlayerImageUrl(playerId: number): string {
    return `https://media.api-sports.io/football/players/${playerId}.png`;
  }

  get pid(): number {
    return this.player.id;
  }

  hasSubstitutedIn(): boolean {
    return this.substitutedInPlayerIds.includes(this.pid);
  }

  getGoalIconIndexes(): number[] {
    const count = this.goalCountsByPlayerId[this.pid] || 0;
    const visibleCount = Math.min(3, count);
    return Array.from({ length: visibleCount }, (_, index) => index);
  }

  getAssistIconIndexes(): number[] {
    const count = this.assistCountsByPlayerId[this.pid] || 0;
    const visibleCount = Math.min(3, count);
    return Array.from({ length: visibleCount }, (_, index) => index);
  }

  getCardIconIndexes(): number[] {
    const redCount = this.redCardCountsByPlayerId[this.pid] || 0;
    if (redCount > 0) {
      const visibleCount = Math.min(3, redCount);
      return Array.from({ length: visibleCount }, (_, index) => index);
    }

    const yellowCount = this.yellowCardCountsByPlayerId[this.pid] || 0;
    const visibleCount = Math.min(3, yellowCount);
    return Array.from({ length: visibleCount }, (_, index) => index);
  }

  getCardEmoji(): string {
    const redCount = this.redCardCountsByPlayerId[this.pid] || 0;
    return redCount > 0 ? '🟥' : '🟨';
  }

  getStackHeightPx(layerCount: number): number {
    if (layerCount <= 0) {
      return 0;
    }
    return 14 + (layerCount - 1) * 5;
  }

  showBenchEventIcons(): boolean {
    if (!this.isSubstitute) {
      return false;
    }

    return (
      this.getGoalIconIndexes().length > 0 ||
      this.getAssistIconIndexes().length > 0 ||
      this.getCardIconIndexes().length > 0 ||
      this.hasSubstitutedIn()
    );
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      // Prevent infinite loop by checking if we're already on a fallback
      if (target.src.includes('default-player.png') || target.src.includes('data:image')) {
        // If fallback also fails, hide the image
        target.style.display = 'none';
        return;
      }
      // Use a data URI placeholder to prevent 404 errors and infinite loops
      // This creates a simple gray placeholder image
      target.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\'%3E%3Crect width=\'40\' height=\'40\' fill=\'%23e5e7eb\'/%3E%3C/svg%3E';
      // If even the data URI fails (shouldn't happen), hide the image
      target.onerror = () => {
        target.style.display = 'none';
      };
    }
  }
}
