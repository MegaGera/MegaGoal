import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PlayerStatBadgeComponent } from '../player-stat-badge/player-stat-badge.component';
import { ImagesService } from '../../../services/images.service';

@Component({
  selector: 'app-basic-team-stat-card',
  standalone: true,
  imports: [CommonModule, PlayerStatBadgeComponent, RouterLink],
  templateUrl: './basic-team-stat-card.component.html',
  styleUrls: ['./basic-team-stat-card.component.css'],
  providers: [ImagesService],
})
export class BasicTeamStatCardComponent {
  @Input() teamName!: string;
  @Input() set teamId(value: number) {
    this._teamId = value;
    this.imageFailed = false;
  }
  get teamId(): number {
    return this._teamId;
  }
  @Input() logoUrl: string | null = null;
  /** Optional ranking position for list rows (1-based). */
  @Input() rank: number | null = null;
  /** Watched appearances. */
  @Input() matchesWatched: number | null = null;
  @Input() goals: number | null = null;
  @Input() country: string | null = null;
  @Input() countryFlag: string | null = null;
  /** Stronger border to mark watched teams in search results. */
  @Input() seen = false;

  private _teamId!: number;
  imageFailed = false;

  constructor(public images: ImagesService) {}

  onImageError(): void {
    this.imageFailed = true;
  }
}
