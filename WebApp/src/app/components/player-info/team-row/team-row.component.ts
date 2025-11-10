import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ImagesService } from '../../../services/images.service';
import { TeamSeasonStats } from '../../../models/playerStats';
import { MatchRowComponent } from './match-row/match-row.component';
import { PlayerStatBadgeComponent } from '../../stats/player-stat-badge/player-stat-badge.component';

@Component({
  selector: 'app-team-row',
  standalone: true,
  imports: [CommonModule, RouterLink, MatchRowComponent, PlayerStatBadgeComponent],
  templateUrl: './team-row.component.html',
  styleUrl: './team-row.component.css'
})
export class TeamRowComponent {
  @Input() teamData: any;
  @Input() season!: number;
  @Input() teamStats?: TeamSeasonStats;
  
  matchesExpanded: boolean = false;

  constructor(public images: ImagesService) {}

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = 'assets/img/default-player.png';
    }
  }

  getSeasonDisplay(): string {
    return `${this.season}/${(this.season + 1).toString().slice(-2)}`;
  }
  
  toggleMatches(): void {
    this.matchesExpanded = !this.matchesExpanded;
  }
  
  hasStats(): boolean {
    return this.teamStats !== undefined;
  }
  
  hasMatches(): boolean {
    return this.teamStats !== undefined && this.teamStats.matches.length > 0;
  }
  
  getSortedMatches(): any[] {
    if (!this.teamStats || !this.teamStats.matches) {
      return [];
    }
    return [...this.teamStats.matches].sort((a, b) => {
      return (b.fixture?.timestamp || 0) - (a.fixture?.timestamp || 0);
    });
  }
}

