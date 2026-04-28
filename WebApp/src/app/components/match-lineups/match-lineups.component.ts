import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LineupData } from '../../models/realMatch';
import { PlayerItemComponent } from './player-item/player-item.component';
import { LineupPitchComponent } from './lineup-pitch/lineup-pitch.component';
import { MatchTeamHeaderComponent } from '../match-team-header/match-team-header.component';

interface LineupPlayer {
  id: number;
  name: string;
  number: number;
  pos: string;
  grid: string | null;
}

interface FieldPlayer {
  row: number;
  col: number;
  player: LineupPlayer;
}

@Component({
  selector: 'app-match-lineups',
  standalone: true,
  imports: [CommonModule, PlayerItemComponent, LineupPitchComponent, MatchTeamHeaderComponent],
  templateUrl: './match-lineups.component.html',
  styleUrl: './match-lineups.component.css'
})
export class MatchLineupsComponent {
  @Input() lineups!: LineupData[];
  @Input() homeTeamId!: number;
  @Input() awayTeamId!: number;

  getHomeLineup(): LineupData | undefined {
    return this.lineups?.find(lineup => lineup.team.id === this.homeTeamId);
  }

  getAwayLineup(): LineupData | undefined {
    return this.lineups?.find(lineup => lineup.team.id === this.awayTeamId);
  }

  /** Both sides use formation grid → single shared pitch (home top half, away bottom half). */
  showUnifiedPitch(): boolean {
    const home = this.getHomeLineup();
    const away = this.getAwayLineup();
    return !!(home && away && this.canRenderField(home) && this.canRenderField(away));
  }

  /**
   * Away half: reverse row order so the forward line is toward the center line and the goalkeeper is in their own goal.
   */
  getAwayHalfRows(lineup: LineupData | undefined): FieldPlayer[][] {
    const rows = this.getFieldRows(lineup);
    return rows.slice().reverse();
  }

  canRenderField(lineup: LineupData | undefined): boolean {
    return !!lineup?.formation;
  }

  getFieldRows(lineup: LineupData | undefined): FieldPlayer[][] {
    if (!lineup) {
      return [];
    }

    const players = this.getValidFieldPlayers(lineup);
    const groupedByRow = new Map<number, FieldPlayer[]>();

    for (const entry of players) {
      if (!groupedByRow.has(entry.row)) {
        groupedByRow.set(entry.row, []);
      }

      groupedByRow.get(entry.row)!.push(entry);
    }

    return Array.from(groupedByRow.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, rowPlayers]) => rowPlayers.sort((a, b) => a.col - b.col));
  }

  getUnplacedStartXI(lineup: LineupData | undefined): Array<{ player: LineupPlayer }> {
    if (!lineup) {
      return [];
    }

    return lineup.startXI.filter(({ player }) => !this.parseGrid(player.grid));
  }

  private getValidFieldPlayers(lineup: LineupData): FieldPlayer[] {
    return lineup.startXI
      .map(({ player }) => {
        const parsedGrid = this.parseGrid(player.grid);
        if (!parsedGrid) {
          return null;
        }

        return {
          row: parsedGrid.row,
          col: parsedGrid.col,
          player
        };
      })
      .filter((entry): entry is FieldPlayer => entry !== null);
  }

  private parseGrid(grid: string | null | undefined): { row: number; col: number } | null {
    if (!grid) {
      return null;
    }

    const parts = grid.split(':');
    if (parts.length !== 2) {
      return null;
    }

    const row = Number(parts[0]);
    const col = Number(parts[1]);
    const isValid = Number.isInteger(row) && Number.isInteger(col) && row > 0 && col > 0;
    return isValid ? { row, col } : null;
  }
}
