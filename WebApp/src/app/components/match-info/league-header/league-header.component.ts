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

  constructor(public images: ImagesService, private router: Router) {}

  navigateToLeague() {
    this.router.navigate(['/app/leagues', this.leagueId], { 
      queryParams: { season: this.leagueSeason } 
    }).then(() => {
      window.scrollTo(0, 0);
    });
  }
}

