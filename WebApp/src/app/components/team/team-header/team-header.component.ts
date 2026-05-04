import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamStar, jamStarF } from '@ng-icons/jam-icons';

import { Team } from '../../../models/team';
import { UserMe } from '../../../models/userMe';
import { ImagesService } from '../../../services/images.service';
import { MegaGoalService } from '../../../services/megagoal.service';
import { StatsService } from '../../../services/stats.service';
import { UserStats } from '../../../models/userStats';
import { QuickStatsComponent } from '../../stats/quick-stats/quick-stats.component';

@Component({
  selector: 'app-team-header',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, QuickStatsComponent, RouterLink, NgIconComponent],
  templateUrl: './team-header.component.html',
  styleUrl: './team-header.component.css',
  providers: [
    ImagesService,
    provideNgIconsConfig({ size: '1.1rem' }),
    provideIcons({ jamStar, jamStarF })
  ]
})
export class TeamHeaderComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) team!: Team;
  teamStats: UserStats | null = null;
  teamStatsLoaded = false;
  favouritePending = false;
  /** Visual size for the header star (slightly smaller on mobile via CSS). */
  readonly favouriteIconSize = '1.25rem';

  private teamStatsSubscription?: Subscription;
  private userMeSubscription?: Subscription;
  private userMe: UserMe | null = null;

  constructor(
    public images: ImagesService,
    private statsService: StatsService,
    private megagoal: MegaGoalService
  ) {}

  get isFavourite(): boolean {
    const id = this.team?.team?.id;
    if (id == null) {
      return false;
    }
    return (this.userMe?.favouriteTeams ?? []).some((t) => t.id === id);
  }

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

  /** Header gradient/shadow tint from domestic league color (hex -> rgba). */
  leagueAccentRgba(alpha: number): string {
    const hex = this.leagueMarkBorderColor.replace(/^#/, '').trim();
    let r: number;
    let g: number;
    let b: number;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      r = 148;
      g = 163;
      b = 184;
    }
    if ([r, g, b].some((n) => Number.isNaN(n))) {
      r = 148;
      g = 163;
      b = 184;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  ngOnInit(): void {
    this.userMeSubscription = this.megagoal.userMe$.subscribe((u) => {
      this.userMe = u;
    });
    if (!this.megagoal.getUserMeSnapshot()) {
      this.megagoal.getUserMe().subscribe({
        error: (err) => console.error('Error loading user profile for favourites:', err)
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['team'] && this.team?.team?.id) {
      this.loadTeamStats(this.team.team.id);
    }
  }

  ngOnDestroy(): void {
    this.teamStatsSubscription?.unsubscribe();
    this.userMeSubscription?.unsubscribe();
  }

  onToggleFavourite(): void {
    if (this.favouritePending || this.team?.team?.id == null) {
      return;
    }
    const id = this.team.team.id;
    const name = this.team.team.name?.trim() || 'Team';
    const nextFavourite = !this.isFavourite;
    this.favouritePending = true;
    this.megagoal.setFavouriteTeam(id, name, nextFavourite).subscribe({
      next: () => {
        this.favouritePending = false;
      },
      error: (err) => {
        this.favouritePending = false;
        console.error('Error updating favourite team:', err);
      }
    });
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
