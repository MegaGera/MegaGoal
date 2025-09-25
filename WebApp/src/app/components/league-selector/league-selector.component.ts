import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { NgFor } from '@angular/common';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { League } from '../../models/league';

@Component({
  selector: 'app-league-selector',
  standalone: true,
  imports: [NgFor],
  templateUrl: './league-selector.component.html',
  styleUrl: './league-selector.component.css'
})
export class LeagueSelectorComponent {

  leagues: League[] = [];
  isLoading: boolean = false;

  constructor(
    private megagoal: MegaGoalService, 
    public images: ImagesService,
    private router: Router
  ) {
    this.getLeagues();
  }

  getLeagues(): void {
    this.setLoading(true);
    this.megagoal.getTopLeagues().subscribe({
      next: (result: League[]) => {
        // Sort leagues by position, with leagues without positions at the end
        this.leagues = result.sort((a, b) => {
          const posA = a.position || Number.MAX_SAFE_INTEGER;
          const posB = b.position || Number.MAX_SAFE_INTEGER;
          return posA - posB;
        });
        this.setLoading(false);
      },
      error: (error: any) => {
        console.error('Error fetching leagues:', error);
        this.setLoading(false);
      }
    });
  }

  selectLeague(league: League): void {
    this.router.navigate(['/app/leagues', league.league.id]);
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }
} 