import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { Team } from '../../../models/team';
import { ImagesService } from '../../../services/images.service';
import { StatsService } from '../../../services/stats.service';
import { UserStats } from '../../../models/userStats';
import { QuickStatsComponent } from '../../stats/quick-stats/quick-stats.component';

@Component({
  selector: 'app-team-header',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, QuickStatsComponent, RouterLink],
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

  /** Corner badge label: domestic league country name when present, else team country. */
  get badgeCountryName(): string {
    const fromLeague = this.team?.domestic_league?.country?.name?.trim();
    if (fromLeague) return fromLeague;
    return this.team?.team?.country?.trim() ?? '';
  }

  /** Flag URL from `domestic_league.country.flag` when set. */
  get badgeCountryFlag(): string | null {
    const url = this.team?.domestic_league?.country?.flag?.trim();
    return url ? url : null;
  }

  /** Domestic league id for logo / league crest link. */
  get domesticLeagueId(): number | null {
    const id = this.team?.domestic_league?.league?.id;
    return id != null && id > 0 ? id : null;
  }

  get domesticLeagueName(): string | null {
    const n = this.team?.domestic_league?.league?.name?.trim();
    return n || null;
  }

  /** Border color for the league crest tile (`colors` from domestic league). */
  get leagueMarkBorderColor(): string {
    const c = this.team?.domestic_league?.colors;
    const raw =
      c?.base_color?.trim() ||
      c?.card_main_color?.trim() ||
      c?.card_trans_color?.trim();
    if (raw) return raw;
    return '#94a3b8';
  }

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

