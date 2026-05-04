import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamArrowSquareUpRight, jamStar, jamStarF } from '@ng-icons/jam-icons';
import { MegaGoalService } from '../../services/megagoal.service';
import { UserMe } from '../../models/userMe';
import { ImagesService } from '../../services/images.service';

/** MegaAuth account / profile (password and account settings). */
export const MEGAAUTH_PROFILE_URL = 'https://megaauth.megagera.com';

interface FavouriteListItem {
  id: number;
  name: string;
  isFavourite: boolean;
  pending: boolean;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIconComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
  providers: [
    provideNgIconsConfig({ size: '1.25em' }),
    provideIcons({ jamArrowSquareUpRight, jamStar, jamStarF }),
  ],
})
export class ProfileComponent implements OnInit {
  readonly megaAuthProfileUrl = MEGAAUTH_PROFILE_URL;

  user: UserMe | null = null;
  favouriteTeams: FavouriteListItem[] = [];
  favouriteLeagues: FavouriteListItem[] = [];
  loading = true;
  loadFailed = false;

  constructor(
    private megaGoalService: MegaGoalService,
    public images: ImagesService
  ) {}

  ngOnInit(): void {
    this.megaGoalService.logPageVisit('profile').subscribe({
      next: () => {},
      error: (err) => console.error('Error logging page visit:', err),
    });

    this.megaGoalService.getUserMe().subscribe({
      next: (u) => {
        this.applyUser(u);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  toggleFavouriteTeam(team: FavouriteListItem): void {
    if (team.pending) {
      return;
    }

    const nextFavourite = !team.isFavourite;
    team.pending = true;

    this.megaGoalService.setFavouriteTeam(team.id, team.name, nextFavourite).subscribe({
      next: (updatedUser) => {
        this.applyUser(updatedUser);
        const localItem = this.favouriteTeams.find((t) => t.id === team.id);
        if (localItem) {
          localItem.isFavourite = nextFavourite;
          localItem.pending = false;
        }
      },
      error: (err) => {
        team.pending = false;
        console.error('Error updating favourite team:', err);
      },
    });
  }

  toggleFavouriteLeague(league: FavouriteListItem): void {
    if (league.pending) {
      return;
    }

    const nextFavourite = !league.isFavourite;
    league.pending = true;

    this.megaGoalService.setFavouriteLeague(league.id, league.name, nextFavourite).subscribe({
      next: (updatedUser) => {
        this.applyUser(updatedUser);
        const localItem = this.favouriteLeagues.find((l) => l.id === league.id);
        if (localItem) {
          localItem.isFavourite = nextFavourite;
          localItem.pending = false;
        }
      },
      error: (err) => {
        league.pending = false;
        console.error('Error updating favourite league:', err);
      },
    });
  }

  private applyUser(user: UserMe): void {
    this.user = user;
    this.favouriteTeams = this.mergeFavourites(this.favouriteTeams, user.favouriteTeams);
    this.favouriteLeagues = this.mergeFavourites(this.favouriteLeagues, user.favouriteLeagues);
  }

  private mergeFavourites(
    existing: FavouriteListItem[],
    current: Array<{ id: number; name: string }>
  ): FavouriteListItem[] {
    const currentIds = new Set(current.map((item) => item.id));
    const merged = existing.map((item) => ({
      ...item,
      isFavourite: currentIds.has(item.id),
      pending: false,
    }));

    for (const item of current) {
      if (!merged.some((existingItem) => existingItem.id === item.id)) {
        merged.push({
          id: item.id,
          name: item.name,
          isFavourite: true,
          pending: false,
        });
      }
    }

    return merged;
  }
}
