import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { jamEyeF, jamTrophy, jamTarget } from '@ng-icons/jam-icons';
import { ionFootball } from '@ng-icons/ionicons';
import { FavouriteTeamStats } from '../../../models/favouriteTeamStats';
import { ImagesService } from '../../../services/images.service';
import { MiniStatCardComponent } from '../mini-stat-card/mini-stat-card.component';

@Component({
  selector: 'app-favourite-team-card',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, NgIconComponent, MiniStatCardComponent],
  templateUrl: './favourite-team-card.component.html',
  styleUrls: ['./favourite-team-card.component.css'],
  providers: [ImagesService, provideIcons({ jamEyeF, jamTrophy, jamTarget, ionFootball })]
})
export class FavouriteTeamCardComponent {
  @Input() teamStats: FavouriteTeamStats | null = null;
  @Input() isLoading: boolean = false;
  @Input() teams: any[] = [];
  @Input() selectedTeamId: number | null = null;
  @Output() teamSelected = new EventEmitter<number>();

  constructor(public images: ImagesService) {}

  getWinRateColor(winRate: number): string {
    if (winRate >= 70) return '#28a745';
    if (winRate >= 50) return '#ffc107';
    return '#dc3545';
  }

  onTeamSelect(teamId: number): void {
    this.teamSelected.emit(teamId);
  }
} 