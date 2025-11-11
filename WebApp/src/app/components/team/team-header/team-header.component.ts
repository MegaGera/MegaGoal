import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Subscription } from 'rxjs';

import { Team } from '../../../models/team';
import { ImagesService } from '../../../services/images.service';
import { StatsService } from '../../../services/stats.service';
import { UserStats } from '../../../models/userStats';
import { QuickStatsComponent } from '../../stats/quick-stats/quick-stats.component';

@Component({
  selector: 'app-team-header',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, QuickStatsComponent],
  templateUrl: './team-header.component.html',
  styleUrl: './team-header.component.css',
  providers: [ImagesService]
})
export class TeamHeaderComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) team!: Team;
  teamStats: UserStats | null = null;
  teamStatsLoaded = false;

  private teamStatsSubscription?: Subscription;

  constructor(public images: ImagesService, private statsService: StatsService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['team'] && this.team?.team?.id) {
      this.loadTeamStats(this.team.team.id);
    }
  }

  ngOnDestroy(): void {
    this.teamStatsSubscription?.unsubscribe();
  }

  private loadTeamStats(teamId: number): void {
    this.teamStatsLoaded = false;
    this.teamStatsSubscription?.unsubscribe();
    this.teamStatsSubscription = this.statsService.getTeamGeneralStats(teamId).subscribe({
      next: (stats: UserStats) => {
        this.teamStats = stats;
        this.teamStatsLoaded = true;
      },
      error: (error: any) => {
        console.error('Error fetching team general stats:', error);
        this.teamStats = null;
        this.teamStatsLoaded = true;
      }
    });
  }
}

