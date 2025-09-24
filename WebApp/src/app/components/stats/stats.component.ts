import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgIconComponent } from '@ng-icons/core';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    NgIconComponent
  ],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.css'
})
export class StatsComponent implements OnInit {
  isLoading = false;
  
  // Placeholder data - will be replaced with actual stats
  generalStats = {
    totalMatches: 0,
    totalLeagues: 0,
    totalTeams: 0,
    favoriteLeague: 'N/A'
  };

  constructor(
    private megaGoalService: MegaGoalService,
    public images: ImagesService
  ) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.isLoading = true;
    
    // TODO: Implement actual stats loading
    // For now, we'll use placeholder data
    setTimeout(() => {
      this.generalStats = {
        totalMatches: 1250,
        totalLeagues: 45,
        totalTeams: 890,
        favoriteLeague: 'Premier League'
      };
      this.isLoading = false;
    }, 1000);
  }

  refreshStats(): void {
    this.loadStats();
  }
}
