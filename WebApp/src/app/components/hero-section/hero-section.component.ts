import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamArrowRight, jamPlus } from '@ng-icons/jam-icons';
import { UserStats } from '../../models/userStats';
import { QuickStatsComponent } from '../stats/quick-stats/quick-stats.component';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIconComponent, QuickStatsComponent],
  templateUrl: './hero-section.component.html',
  styleUrl: './hero-section.component.css',
  providers: [provideNgIconsConfig({
    size: '1.2rem',
  }), provideIcons({ jamArrowRight, jamPlus })]
})
export class HeroSectionComponent {
  @Input() userStats: UserStats | null = null;
  @Input() userStatsLoaded: boolean = false;

  getMonthlyMatches(): number {
    if (!this.userStats?.monthlyActivity || this.userStats.monthlyActivity.length === 0) {
      return 0;
    }
    const lastMonth = this.userStats.monthlyActivity[this.userStats.monthlyActivity.length - 1];
    return lastMonth?.matches ?? 0;
  }
} 