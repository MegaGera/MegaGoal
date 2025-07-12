import { Component, Input } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { jamEyeF, jamTrophy, jamTarget } from '@ng-icons/jam-icons';
import { ionFootball } from '@ng-icons/ionicons';
import { ImagesService } from '../../../services/images.service';
import { FavouriteTeamStats } from '../../../models/favouriteTeamStats';

@Component({
  selector: 'app-favourite-team-card',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, NgIconComponent],
  templateUrl: './favourite-team-card.component.html',
  styleUrl: './favourite-team-card.component.css',
  providers: [ImagesService, provideIcons({ jamEyeF, jamTrophy, jamTarget, ionFootball })]
})
export class FavouriteTeamCardComponent {
  @Input() teamStats: FavouriteTeamStats | null = null;
  @Input() isLoading: boolean = false;

  constructor(public images: ImagesService) {}

  getFormColor(form: string): string {
    if (!form) return '#6c757d';
    const lastResult = form.charAt(form.length - 1);
    switch (lastResult) {
      case 'W': return '#28a745';
      case 'D': return '#ffc107';
      case 'L': return '#dc3545';
      default: return '#6c757d';
    }
  }

  getWinRateColor(rate: number): string {
    if (rate >= 70) return '#28a745';
    if (rate >= 50) return '#ffc107';
    return '#dc3545';
  }
} 