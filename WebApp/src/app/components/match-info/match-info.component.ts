/* 
  Match Info component to display detailed information about a specific match
*/

import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { AuthService } from '../../services/auth.service';
import { UpdaterService } from '../../services/updater.service';
import { RealMatch, TeamStatistics } from '../../models/realMatch';
import { isFinishedStatus } from '../../config/matchStatus';
import { LeagueHeaderComponent } from './league-header/league-header.component';
import { GeneralMatchCardComponent } from '../general-match-card/general-match-card.component';
import { MatchEventsComponent } from '../match-events/match-events.component';
import { MatchStatisticsComponent } from '../match-statistics/match-statistics.component';
import { MatchLineupsComponent } from '../match-lineups/match-lineups.component';

@Component({
  selector: 'app-match-info',
  standalone: true,
  imports: [CommonModule, LeagueHeaderComponent, GeneralMatchCardComponent, MatchEventsComponent, MatchStatisticsComponent, MatchLineupsComponent],
  templateUrl: './match-info.component.html',
  styleUrl: './match-info.component.css',
  providers: [ImagesService]
})
export class MatchInfoComponent {

  queryMatchId!: number;
  match!: RealMatch;
  homeStatistics: TeamStatistics | undefined;
  awayStatistics: TeamStatistics | undefined;
  loading: boolean = true;
  isAdmin: boolean = false;
  isUpdating: boolean = false;
  highlightsVideo: any = null;
  loadingVideo: boolean = false;

  constructor(
    private megagoal: MegaGoalService, 
    private router: Router, 
    public images: ImagesService,
    private activatedRoute: ActivatedRoute,
    private authService: AuthService,
    private updater: UpdaterService,
    private sanitizer: DomSanitizer
  ) {
    this.activatedRoute.queryParamMap.subscribe(params => {
      this.queryMatchId = +params.get('id')! || 0;
      this.init();
    });
    
    // Check if user is admin
    this.authService.isAdmin().subscribe(isAdmin => {
      this.isAdmin = isAdmin;
    });
  }

  init() {
    this.megagoal.getRealMatchById(this.queryMatchId).subscribe(result => {
      if (result != undefined) {
        this.match = result;
        if (this.match.statistics && this.match.statistics.length >= 2) {
          this.homeStatistics = this.match.statistics[0];
          this.awayStatistics = this.match.statistics[1];
        }
        this.loading = false;
        
        // Log page visit with match information
        this.megagoal.logPageVisit('match-info', {
          fixtureId: this.match.fixture.id,
          homeTeam: this.match.teams.home.name,
          awayTeam: this.match.teams.away.name,
          leagueId: this.match.league.id,
          leagueName: this.match.league.name
        }).subscribe({
          next: () => {},
          error: (error) => console.error('Error logging page visit:', error)
        });
        
        // Load highlights video if match is finished
        if (this.isFinished()) {
          this.loadHighlights();
        }
      } else {
        this.router.navigate(["/app/matches"]);
      }
    }, error => {
      this.router.navigate(["/app/matches"]);
    });
  }

  loadHighlights(): void {
    if (!this.match) return;
    
    this.loadingVideo = true;
    const homeTeam = this.match.teams.home.name;
    const awayTeam = this.match.teams.away.name;
    const homeScore = this.match.goals.home;
    const awayScore = this.match.goals.away;
    const date = this.match.fixture.date;

    this.megagoal.getMatchHighlights(homeTeam, awayTeam, homeScore, awayScore, date).subscribe({
      next: (video) => {
        this.highlightsVideo = video;
        this.loadingVideo = false;
      },
      error: (error) => {
        console.error('Error loading highlights:', error);
        this.loadingVideo = false;
      }
    });
  }

  hasStatistics(): boolean {
    return Array.isArray(this.match?.statistics) && this.match.statistics.length > 0;
  }

  isFinished(): boolean {
    return isFinishedStatus(this.match?.fixture.status?.short);
  }

  getSafeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  updateStatistics(): void {
    if (!this.match || this.isUpdating) return;
    
    this.isUpdating = true;
    this.updater.updateMatchStatistics(this.match.fixture.id).subscribe({
      next: () => {
        this.isUpdating = false;
        // Reload the match data to get updated statistics
        this.init();
      },
      error: (error) => {
        console.error('Error updating match statistics:', error);
        this.isUpdating = false;
        alert('Error updating match statistics. Please try again.');
      }
    });
  }

}

