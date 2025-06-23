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
        this.leagues = result;
        this.setLoading(false);
      },
      error: (error: any) => {
        console.error('Error fetching leagues:', error);
        this.setLoading(false);
      }
    });
  }

  selectLeague(league: League): void {
    this.router.navigate(['/leagues', league.league.id]);
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }
} 