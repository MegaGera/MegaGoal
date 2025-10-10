import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { NgFor } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { MegaGoalService } from '../../services/megagoal.service';
import { StatsService } from '../../services/stats.service';
import { ImagesService } from '../../services/images.service';
import { League, LeagueStats } from '../../models/league';

@Component({
  selector: 'app-league-selector',
  standalone: true,
  imports: [NgFor],
  templateUrl: './league-selector.component.html',
  styleUrl: './league-selector.component.css'
})
export class LeagueSelectorComponent {

  leagues: League[] = [];
  leagueViewCounts: Map<number, number> = new Map();
  isLoading: boolean = false;

  constructor(
    private megagoal: MegaGoalService,
    private stats: StatsService,
    public images: ImagesService,
    private router: Router
  ) {
    this.getLeagues();
  }

  getLeagues(): void {
    this.setLoading(true);
    
    // Fetch both leagues and league view stats in parallel
    // If stats fail, continue with empty array so leagues still display
    forkJoin({
      leagues: this.megagoal.getTopLeagues(),
      leagueStats: this.stats.getLeaguesViewed().pipe(
        catchError(error => {
          console.warn('Failed to fetch league stats, continuing without view counts:', error);
          return of([]); // Return empty array if stats fail
        })
      )
    }).subscribe({
      next: (result) => {
        // Create a map of league_id to view count
        this.leagueViewCounts.clear();
        result.leagueStats.forEach((stat: LeagueStats) => {
          this.leagueViewCounts.set(stat.league_id, stat.count);
        });

        // Sort leagues: first by view count (descending), then by position
        this.leagues = result.leagues.sort((a, b) => {
          const viewsA = this.leagueViewCounts.get(a.league.id) || 0;
          const viewsB = this.leagueViewCounts.get(b.league.id) || 0;
          
          // If both have views or both don't have views, compare them
          if ((viewsA > 0 && viewsB > 0) || (viewsA === 0 && viewsB === 0)) {
            if (viewsA > 0 && viewsB > 0) {
              // Both have views - sort by view count descending
              return viewsB - viewsA;
            } else {
              // Neither has views - sort by position
              const posA = a.position || Number.MAX_SAFE_INTEGER;
              const posB = b.position || Number.MAX_SAFE_INTEGER;
              return posA - posB;
            }
          }
          
          // One has views and one doesn't - leagues with views come first
          return viewsB - viewsA;
        });
        
        this.setLoading(false);
      },
      error: (error: any) => {
        // This will only trigger if the leagues API fails (critical error)
        console.error('Error fetching leagues:', error);
        this.setLoading(false);
      }
    });
  }

  getLeagueViewCount(leagueId: number): number | null {
    const count = this.leagueViewCounts.get(leagueId);
    return count && count > 0 ? count : null;
  }

  selectLeague(league: League): void {
    this.router.navigate(['/app/leagues', league.league.id]);
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }
} 