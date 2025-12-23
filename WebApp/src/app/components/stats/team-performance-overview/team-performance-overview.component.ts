import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FavouriteTeamStats } from '../../../models/favouriteTeamStats';
import { BasicStatCardComponent } from '../basic-stat-card/basic-stat-card.component';
import { GeneralCardComponent } from '../../general-card/general-card.component';

@Component({
  selector: 'app-team-performance-overview',
  standalone: true,
  imports: [CommonModule, BasicStatCardComponent, GeneralCardComponent],
  templateUrl: './team-performance-overview.component.html',
  styleUrls: ['./team-performance-overview.component.css']
})
export class TeamPerformanceOverviewComponent {
  @Input() teamStats: FavouriteTeamStats | null = null;
  @Input() isLoading: boolean = false;

  getPerMatchValue(total?: number | null): number | null {
    if (!this.teamStats || this.teamStats.matches_watched === 0) {
      return null;
    }
    if (total === undefined || total === null) {
      return null;
    }
    return parseFloat((total / this.teamStats.matches_watched).toFixed(2));
  }
}

