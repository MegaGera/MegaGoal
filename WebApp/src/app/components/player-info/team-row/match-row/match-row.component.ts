import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ImagesService } from '../../../../services/images.service';
import { LeagueColorsService } from '../../../../services/league-colors.service';
import { Match } from '../../../../models/match';

@Component({
  selector: 'app-match-row',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './match-row.component.html',
  styleUrl: './match-row.component.css'
})
export class MatchRowComponent implements OnInit {
  @Input() match!: Match;
  leagueBorder = '#94a3b8';

  constructor(
    public images: ImagesService,
    private leagueColors: LeagueColorsService
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

  hasGoals(): boolean {
    return this.match.player_stats !== undefined && this.match.player_stats.goals > 0;
  }

  hasAssists(): boolean {
    return this.match.player_stats !== undefined && this.match.player_stats.assists > 0;
  }

  hasYellowCards(): boolean {
    return this.match.player_stats !== undefined && this.match.player_stats.yellow_cards > 0;
  }

  hasRedCards(): boolean {
    return this.match.player_stats !== undefined && this.match.player_stats.red_cards > 0;
  }

  started(): boolean {
    return this.match.player_stats !== undefined && this.match.player_stats.started;
  }

  get statMarks(): { kind: string; title: string; value: string | number; icon?: string }[] {
    const stats = this.match.player_stats;
    const marks: { kind: string; title: string; value: string | number; icon?: string }[] = [];
    if (this.started()) marks.push({ kind: 'xi', title: 'Started', value: 'XI' });
    if (this.hasGoals()) marks.push({ kind: 'goal', title: 'Goals', value: stats!.goals, icon: 'ball' });
    if (this.hasAssists()) marks.push({ kind: 'assist', title: 'Assists', value: stats!.assists, icon: 'target' });
    if (this.hasYellowCards()) marks.push({ kind: 'yellow', title: 'Yellow cards', value: stats!.yellow_cards, icon: 'yellow' });
    if (this.hasRedCards()) marks.push({ kind: 'red', title: 'Red cards', value: stats!.red_cards, icon: 'red' });
    return marks;
  }

  /** Keeps more than two badges on two rows. */
  markColumns(): number {
    return Math.ceil(this.statMarks.length / 2);
  }

  /** Column where the second line starts, so that line sits on the right. */
  secondRowColumn(index: number): number | null {
    const count = this.statMarks.length;
    if (count <= 2) return null;
    const columns = Math.ceil(count / 2);
    if (index !== columns) return null;
    const start = columns * 2 - count + 1;
    return start > 1 ? start : null;
  }
}

