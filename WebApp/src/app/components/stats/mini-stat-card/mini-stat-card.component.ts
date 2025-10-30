import { Component, Input } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIconComponent } from '@ng-icons/core';
import { ImagesService } from '../../../services/images.service';

@Component({
  selector: 'app-mini-stat-card',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, NgIconComponent, RouterLink],
  templateUrl: './mini-stat-card.component.html',
  styleUrls: ['./mini-stat-card.component.css']
})
export class MiniStatCardComponent {
  @Input() label: string = '';
  @Input() value: string = '';
  @Input() subValue?: string; // Optional sub-value that shows on hover
  @Input() type: 'crazy-match' | 'biggest-rival' | 'most-viewed-location' | 'home-stadium' | 'away-support' | 'total-away-visits' | 'king-of-draws' | 'biggest-win-percentage' | 'biggest-lose-percentage' | 'most-boring-team' | 'most-crazy-team' | 'most-watched-stadium' | 'top-goalscorer' | 'top-assist-provider' | 'most-watched-player' = 'crazy-match';
  @Input() team_id?: number;
  @Input() match_id?: number;
  @Input() player_id?: number;
  @Input() interactable: boolean = true;

  constructor(public images: ImagesService) {}

  getIcon(): string {
    switch (this.type) {
      case 'crazy-match': return '🔥';
      case 'biggest-rival': return '⚔️';
      case 'most-viewed-location': return '📍';
      case 'home-stadium': return '🏟️';
      case 'away-support': return '🏟️';
      case 'total-away-visits': return '🚌';
      case 'king-of-draws': return '🤝';
      case 'biggest-win-percentage': return '👑';
      case 'biggest-lose-percentage': return '😢';
      case 'most-boring-team': return '😴';
      case 'most-crazy-team': return '🤪';
      case 'most-watched-stadium': return '🏟️';
      case 'top-goalscorer': return '⚽';
      case 'top-assist-provider': return '🎯';
      case 'most-watched-player': return '👤';
      default: return '📊';
    }
  }

  shouldShowTeamBadge(): boolean {
    return (this.type === 'biggest-rival' || this.type === 'king-of-draws' || this.type === 'biggest-win-percentage' || this.type === 'biggest-lose-percentage' || this.type === 'most-boring-team' || this.type === 'most-crazy-team') && this.team_id !== undefined;
  }

  isPlayerType(): boolean {
    return this.type === 'top-goalscorer' || this.type === 'top-assist-provider' || this.type === 'most-watched-player';
  }

  onPlayerImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = 'assets/img/default-player.png';
    }
  }
} 