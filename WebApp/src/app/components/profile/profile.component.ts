import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamCheck, jamClose, jamPencil, jamStar, jamStarF } from '@ng-icons/jam-icons';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { forkJoin, Subscription } from 'rxjs';
import { MegaGoalService } from '../../services/megagoal.service';
import { AuthService } from '../../services/auth.service';
import { UserMe } from '../../models/userMe';
import { ImagesService } from '../../services/images.service';

interface FavouriteListItem {
  id: number;
  name: string;
  isFavourite: boolean;
  pending: boolean;
}

type FavouriteKind = 'team' | 'league';

interface FavouriteSearchHit {
  type: FavouriteKind;
  id: number;
  name: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgIconComponent, DragDropModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
  providers: [
    provideNgIconsConfig({ size: '1.25em' }),
    provideIcons({ jamCheck, jamClose, jamPencil, jamStar, jamStarF }),
  ],
})
export class ProfileComponent implements OnInit, OnDestroy {
  user: UserMe | null = null;
  favouriteTeams: FavouriteListItem[] = [];
  favouriteLeagues: FavouriteListItem[] = [];
  loading = true;
  loadFailed = false;

  favouriteQuery = '';
  favouriteSearchOpen = false;
  favouriteSearchLoading = false;
  favouriteSearchError = false;
  favouriteSearchResults: FavouriteSearchHit[] = [];
  private favouriteSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private favouriteSearchSub?: Subscription;
  private favouriteSearchRequestId = 0;
  private pendingFavourites = new Set<string>();
  private reorderGeneration: Record<FavouriteKind, number> = { team: 0, league: 0 };

  @ViewChild('favouriteSearchRoot') favouriteSearchRoot?: ElementRef<HTMLElement>;

  /** Custom profile picture URL when available; null shows the default avatar. */
  profilePictureUrl: string | null = null;
  profilePictureUploading = false;
  profilePictureError = '';

  email: string | null = null;
  editingEmail = false;
  emailDraft = '';
  emailSubmitting = false;
  emailError = '';

  showPasswordModal = false;
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  passwordSubmitting = false;
  passwordError = '';
  passwordSuccess = '';

  constructor(
    private megaGoalService: MegaGoalService,
    private authService: AuthService,
    public images: ImagesService
  ) {}

  get hasEmail(): boolean {
    return !!this.email?.trim();
  }

  ngOnDestroy(): void {
    if (this.favouriteSearchTimer) {
      clearTimeout(this.favouriteSearchTimer);
    }
    this.favouriteSearchSub?.unsubscribe();
  }

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

    this.authService.getAuthUser().subscribe({
      next: (authUser) => {
        const value = authUser.email?.trim() || '';
        this.email = value || null;
      },
      error: () => {
        this.email = null;
      },
    });
  }

  onAvatarClick(fileInput: HTMLInputElement): void {
    if (this.profilePictureUploading) {
      return;
    }
    this.profilePictureError = '';
    fileInput.click();
  }

  onProfilePictureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.profilePictureUploading) {
      return;
    }

    this.profilePictureUploading = true;
    this.profilePictureError = '';

    this.megaGoalService.uploadProfilePicture(file).subscribe({
      next: (updatedUser) => {
        this.applyUser(updatedUser);
        this.profilePictureUploading = false;
      },
      error: () => {
        this.profilePictureUploading = false;
        this.profilePictureError = 'Action not available now, try again later';
      },
    });
  }

  startEditEmail(): void {
    if (this.emailSubmitting) {
      return;
    }
    this.emailError = '';
    this.emailDraft = this.email || '';
    this.editingEmail = true;
  }

  cancelEditEmail(): void {
    if (this.emailSubmitting) {
      return;
    }
    this.editingEmail = false;
    this.emailDraft = '';
    this.emailError = '';
  }

  saveEmail(): void {
    if (this.emailSubmitting) {
      return;
    }

    const nextEmail = this.emailDraft.trim();
    this.emailError = '';

    if (!nextEmail) {
      this.emailError = 'Email is required.';
      return;
    }

    if (nextEmail === (this.email || '')) {
      this.editingEmail = false;
      return;
    }

    this.emailSubmitting = true;

    this.authService.changeEmail(nextEmail).subscribe({
      next: (res) => {
        this.email = res.email?.trim() || nextEmail;
        this.emailSubmitting = false;
        this.editingEmail = false;
        this.emailDraft = '';
        this.emailError = '';
      },
      error: (err) => {
        this.emailSubmitting = false;
        this.emailError = err?.error?.error || 'Could not update email. Please try again.';
      },
    });
  }

  openPasswordModal(): void {
    this.resetPasswordForm();
    this.showPasswordModal = true;
  }

  closePasswordModal(): void {
    if (this.passwordSubmitting) {
      return;
    }
    this.showPasswordModal = false;
    this.resetPasswordForm();
  }

  submitPasswordChange(): void {
    if (this.passwordSubmitting) {
      return;
    }

    this.passwordError = '';
    this.passwordSuccess = '';

    if (!this.oldPassword || !this.newPassword || !this.confirmPassword) {
      this.passwordError = 'Please fill in all fields.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'New passwords do not match.';
      return;
    }

    this.passwordSubmitting = true;

    this.authService.changePassword(this.oldPassword, this.newPassword).subscribe({
      next: () => {
        this.passwordSubmitting = false;
        this.passwordSuccess = 'Password changed successfully.';
        this.oldPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        setTimeout(() => {
          this.showPasswordModal = false;
          this.resetPasswordForm();
        }, 1500);
      },
      error: (err) => {
        this.passwordSubmitting = false;
        this.passwordError =
          err?.error?.error || 'Password change failed. Please try again.';
      },
    });
  }

  onFavouriteQueryChange(value: string): void {
    this.favouriteQuery = value;
    if (this.favouriteSearchTimer) {
      clearTimeout(this.favouriteSearchTimer);
      this.favouriteSearchTimer = null;
    }

    const requestId = ++this.favouriteSearchRequestId;
    this.favouriteSearchSub?.unsubscribe();
    const trimmed = value.trim();
    if (!trimmed) {
      this.favouriteSearchResults = [];
      this.favouriteSearchLoading = false;
      this.favouriteSearchError = false;
      this.favouriteSearchOpen = false;
      return;
    }

    this.favouriteSearchOpen = true;
    this.favouriteSearchLoading = true;
    this.favouriteSearchError = false;
    this.favouriteSearchTimer = setTimeout(() => {
      this.favouriteSearchTimer = null;
      if (requestId !== this.favouriteSearchRequestId) {
        return;
      }
      this.runFavouriteSearch(trimmed, requestId);
    }, 250);
  }

  onFavouriteSearchFocus(): void {
    if (this.favouriteQuery.trim()) {
      this.favouriteSearchOpen = true;
    }
  }

  selectFavouriteHit(hit: FavouriteSearchHit): void {
    if (this.isFavouritePending(hit.type, hit.id)) {
      return;
    }
    const list = hit.type === 'team' ? this.favouriteTeams : this.favouriteLeagues;
    const existing = list.find((item) => item.id === hit.id);
    const item: FavouriteListItem = existing ?? {
      id: hit.id,
      name: hit.name,
      isFavourite: false,
      pending: false,
    };
    if (hit.type === 'team') {
      this.toggleFavouriteTeam(item);
    } else {
      this.toggleFavouriteLeague(item);
    }
  }

  isHitFavourite(hit: FavouriteSearchHit): boolean {
    const list = hit.type === 'team' ? this.favouriteTeams : this.favouriteLeagues;
    return list.some((item) => item.id === hit.id && item.isFavourite);
  }

  isFavouritePending(type: FavouriteKind, id: number): boolean {
    return this.pendingFavourites.has(this.favouriteKey(type, id));
  }

  favouriteListBusy(type: FavouriteKind): boolean {
    const prefix = `${type}:`;
    for (const key of this.pendingFavourites) {
      if (key.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  }

  hitImageUrl(hit: FavouriteSearchHit): string {
    return hit.type === 'team'
      ? this.images.getRouteImageTeam(hit.id)
      : this.images.getRouteImageLeagueSm(hit.id);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const root = this.favouriteSearchRoot?.nativeElement;
    const target = event.target;
    if (!root || !(target instanceof Node) || root.contains(target)) {
      return;
    }
    this.favouriteSearchOpen = false;
  }

  dropFavourites(type: FavouriteKind, event: CdkDragDrop<FavouriteListItem[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const list = type === 'team' ? this.favouriteTeams : this.favouriteLeagues;
    const previousIndex = event.previousIndex;
    const currentIndex = event.currentIndex;
    const previousIds = list.filter((item) => item.isFavourite).map((item) => item.id);

    // Same turn as the drop. A later tick paints the old order first, which shows up as a
    // refresh when the row moved upward.
    moveItemInArray(list, previousIndex, currentIndex);
    const ids = list.filter((item) => item.isFavourite).map((item) => item.id);
    if (ids.join(',') === previousIds.join(',')) {
      return;
    }

    const generation = ++this.reorderGeneration[type];
    const request =
      type === 'team'
        ? this.megaGoalService.reorderFavouriteTeams(ids)
        : this.megaGoalService.reorderFavouriteLeagues(ids);

    request.subscribe({
      next: () => {},
      error: (err) => {
        if (generation !== this.reorderGeneration[type]) {
          return;
        }
        moveItemInArray(list, currentIndex, previousIndex);
        console.error(`Error reordering favourite ${type}s:`, err);
      },
    });
  }

  toggleFavouriteTeam(team: FavouriteListItem): void {
    this.toggleFavourite('team', team);
  }

  toggleFavouriteLeague(league: FavouriteListItem): void {
    this.toggleFavourite('league', league);
  }

  private toggleFavourite(type: FavouriteKind, item: FavouriteListItem): void {
    if (this.isFavouritePending(type, item.id)) {
      return;
    }

    const nextFavourite = !item.isFavourite;
    this.pendingFavourites.add(this.favouriteKey(type, item.id));
    item.pending = true;

    const request =
      type === 'team'
        ? this.megaGoalService.setFavouriteTeam(item.id, item.name, nextFavourite)
        : this.megaGoalService.setFavouriteLeague(item.id, item.name, nextFavourite);

    request.subscribe({
      next: (updatedUser) => {
        this.pendingFavourites.delete(this.favouriteKey(type, item.id));
        this.applyUser(updatedUser);
      },
      error: (err) => {
        this.pendingFavourites.delete(this.favouriteKey(type, item.id));
        item.pending = false;
        console.error(`Error updating favourite ${type}:`, err);
      },
    });
  }

  private runFavouriteSearch(query: string, requestId: number): void {
    this.favouriteSearchSub?.unsubscribe();
    this.favouriteSearchLoading = true;
    this.favouriteSearchError = false;

    this.favouriteSearchSub = forkJoin({
      teams: this.megaGoalService.searchTeams(query, { limit: 8 }),
      leagues: this.megaGoalService.searchLeagues(query, { limit: 8 }),
    }).subscribe({
      next: ({ teams, leagues }) => {
        if (requestId !== this.favouriteSearchRequestId) {
          return;
        }
        const teamHits: FavouriteSearchHit[] = teams.teams
          .filter((team) => Number.isFinite(team.id) && team.name)
          .map((team) => ({ type: 'team', id: team.id, name: team.name }));
        const leagueHits: FavouriteSearchHit[] = leagues.leagues
          .filter((league) => Number.isFinite(league.id) && league.name)
          .map((league) => ({ type: 'league', id: league.id, name: league.name }));
        const merged: FavouriteSearchHit[] = [];
        const count = Math.max(teamHits.length, leagueHits.length);
        for (let i = 0; i < count; i++) {
          if (teamHits[i]) merged.push(teamHits[i]);
          if (leagueHits[i]) merged.push(leagueHits[i]);
        }
        this.favouriteSearchResults = merged;
        this.favouriteSearchLoading = false;
      },
      error: () => {
        if (requestId !== this.favouriteSearchRequestId) {
          return;
        }
        this.favouriteSearchResults = [];
        this.favouriteSearchLoading = false;
        this.favouriteSearchError = true;
      },
    });
  }

  private favouriteKey(type: FavouriteKind, id: number): string {
    return `${type}:${id}`;
  }

  private resetPasswordForm(): void {
    this.oldPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.passwordSubmitting = false;
    this.passwordError = '';
    this.passwordSuccess = '';
  }

  private applyUser(user: UserMe): void {
    this.user = user;
    this.favouriteTeams = this.mergeFavourites(this.favouriteTeams, user.favouriteTeams);
    this.favouriteLeagues = this.mergeFavourites(this.favouriteLeagues, user.favouriteLeagues);
    this.profilePictureUrl = user.profilePicture?.path
      ? this.images.getRouteImageProfile(user.profilePicture.path, user.profilePicture.updatedOn)
      : null;
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
