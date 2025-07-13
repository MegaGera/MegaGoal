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
  @Input() type: 'crazy-match' | 'biggest-rival' | 'most-viewed-location' | 'home-stadium' | 'away-support' | 'total-away-visits' = 'crazy-match';
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
      default: return '📊';
    }
  }

  shouldShowTeamBadge(): boolean {
    return this.type === 'biggest-rival' && this.team_id !== undefined;
  }
} 