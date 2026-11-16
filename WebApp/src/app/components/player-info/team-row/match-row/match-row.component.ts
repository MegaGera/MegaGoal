import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamEyeCloseF, jamEyeF } from '@ng-icons/jam-icons';
import { ImagesService } from '../../../../services/images.service';
import { LeagueColorsService } from '../../../../services/league-colors.service';
import { MegaGoalService } from '../../../../services/megagoal.service';
import { MatchParserService } from '../../../../services/match-parser.service';
import { Match } from '../../../../models/match';

@Component({
  selector: 'app-match-row',
  standalone: true,
  imports: [CommonModule, RouterLink, NgIconComponent],
  templateUrl: './match-row.component.html',
  styleUrl: './match-row.component.css',
  providers: [
    provideNgIconsConfig({ size: '1.2rem' }),
    provideIcons({ jamEyeCloseF, jamEyeF })
  ]
})
export class MatchRowComponent implements OnInit {
  @Input() match!: Match;
  leagueBorder = '#94a3b8';
  toggling = false;

  constructor(
    public images: ImagesService,
    private leagueColors: LeagueColorsService,
    private megaGoal: MegaGoalService,
    private matchParser: MatchParserService
  ) {}

  ngOnInit(): void {
    const leagueId = this.match?.league?.id;
    if (!leagueId) {
      return;
    }
    this.leagueColors.ensureLeagueBorderColor(leagueId).then((color) => {
      this.leagueBorder = color;
    });
  }

  roundLabel(): string {
    const round = this.match?.league?.round?.trim();
    if (!round) {
      return '';
    }
    const regularSeason = round.match(/^Regular Season - (\d+)$/);
    if (regularSeason) {
      return `Matchday ${regularSeason[1]}`;
    }
    const leagueStage = round.match(/^League Stage - (\d+)$/);
    if (leagueStage) {
      return `League round ${leagueStage[1]}`;
    }
    const groupStage = round.match(/^Group Stage - (\d+)$/);
    if (groupStage) {
      return `Group round ${groupStage[1]}`;
    }
    return round;
  }

  /** Watched list rows always highlight; career lists use match.watched. */
  isWatched(): boolean {
    return this.match.watched !== false;
  }

  /** Same mark and unmark calls as the match card. The row link does not open. */
  toggleWatched(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.toggling) {
      return;
    }
    const mark = !this.isWatched();
    const previous = this.match.watched;
    this.match.watched = mark;
    this.toggling = true;
    const done = () => {
      this.toggling = false;
    };
    const failed = () => {
      this.match.watched = previous;
      this.toggling = false;
    };
    if (mark) {
      this.megaGoal.createMatch(this.watchPayload()).subscribe({ next: done, error: failed });
      return;
    }
    this.megaGoal.deleteMatch(this.match.fixture.id).subscribe({ next: done, error: failed });
  }

  private watchPayload() {
    const request = this.matchParser.matchToMatchRequest(this.match);
    delete request.watched;
    return request;
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = 'assets/img/default-player.png';
    }
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  /** One icon per goal, assist, or card. */
  get statIcons(): Array<'ball' | 'target' | 'yellow' | 'red'> {
    const stats = this.match.player_stats;
    if (!stats) {
      return [];
    }
    const icons: Array<'ball' | 'target' | 'yellow' | 'red'> = [];
    for (let i = 0; i < stats.goals; i++) icons.push('ball');
    for (let i = 0; i < stats.assists; i++) icons.push('target');
    for (let i = 0; i < stats.yellow_cards; i++) icons.push('yellow');
    for (let i = 0; i < stats.red_cards; i++) icons.push('red');
    return icons;
  }

  get statTitle(): string {
    const stats = this.match.player_stats;
    if (!stats) {
      return '';
    }
    const parts: string[] = [];
    if (stats.goals > 0) parts.push(stats.goals === 1 ? '1 goal' : `${stats.goals} goals`);
    if (stats.assists > 0) parts.push(stats.assists === 1 ? '1 assist' : `${stats.assists} assists`);
    if (stats.yellow_cards > 0) parts.push(stats.yellow_cards === 1 ? '1 yellow card' : `${stats.yellow_cards} yellow cards`);
    if (stats.red_cards > 0) parts.push(stats.red_cards === 1 ? '1 red card' : `${stats.red_cards} red cards`);
    return parts.join(', ');
  }
}

