import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ImagesService } from '../../../services/images.service';

@Component({
  selector: 'app-league-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './league-header.component.html',
  styleUrl: './league-header.component.css',
  providers: [ImagesService]
})
export class LeagueHeaderComponent {
  @Input() leagueId!: number;
  @Input() leagueName!: string;
  @Input() leagueRound!: string;
  @Input() leagueSeason!: number;
  @Input() countryName?: string;
  @Input() countryFlag?: string;
  @Input() leagueColors?: {
    base_color?: string;
    card_main_color?: string;
    card_trans_color?: string;
  };

  constructor(public images: ImagesService, private router: Router) {}

  /** CSS variables for gradient border/title when league settings colors exist */
  get leagueThemeStyle(): Record<string, string> | null {
    const c = this.leagueColors;
    if (!c) return null;
    const start =
      c.card_main_color?.trim() ||
      c.base_color?.trim() ||
      '';
    const end =
      c.card_trans_color?.trim() ||
      c.card_main_color?.trim() ||
      c.base_color?.trim() ||
      '';
    if (!start && !end) return null;
    return {
      '--league-border-start': start || end || '#dc143c',
      '--league-border-end': end || start || '#ff6b6b'
    };
  }

  navigateToLeague() {
    this.router.navigate(['/app/leagues', this.leagueId], { 
      queryParams: { season: this.leagueSeason } 
    }).then(() => {
      window.scrollTo(0, 0);
    });
  }
}

