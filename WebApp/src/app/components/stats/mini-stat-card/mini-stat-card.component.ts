import { Component, Input } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { NgIconComponent } from '@ng-icons/core';
import { ImagesService } from '../../../services/images.service';

@Component({
  selector: 'app-mini-stat-card',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, NgIconComponent],
  templateUrl: './mini-stat-card.component.html',
  styleUrls: ['./mini-stat-card.component.css']
})
export class MiniStatCardComponent {
  @Input() label: string = '';
  @Input() value: string = '';
  @Input() subValue?: string; // Optional sub-value that shows on hover
  @Input() type: 'crazy-match' | 'biggest-rival' | 'most-viewed-location' | 'home-stadium' | 'away-support' | 'total-away-visits' | 'king-of-draws' | 'biggest-win-percentage' | 'biggest-lose-percentage' | 'most-boring-team' | 'most-crazy-team' | 'most-watched-stadium' = 'crazy-match';
  @Input() team_id?: number;

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
      default: return '📊';
    }
  }

  shouldShowTeamBadge(): boolean {
    return (this.type === 'biggest-rival' || this.type === 'king-of-draws' || this.type === 'biggest-win-percentage' || this.type === 'biggest-lose-percentage' || this.type === 'most-boring-team' || this.type === 'most-crazy-team') && this.team_id !== undefined;
  }
} 