import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamCheck, jamClose, jamPencil, jamStar, jamStarF } from '@ng-icons/jam-icons';
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

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgIconComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
  providers: [
    provideNgIconsConfig({ size: '1.25em' }),
    provideIcons({ jamCheck, jamClose, jamPencil, jamStar, jamStarF }),
  ],
})
export class ProfileComponent implements OnInit {
  user: UserMe | null = null;
  favouriteTeams: FavouriteListItem[] = [];
  favouriteLeagues: FavouriteListItem[] = [];
  loading = true;
  loadFailed = false;

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
