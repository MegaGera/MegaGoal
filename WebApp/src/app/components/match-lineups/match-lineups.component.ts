import { Component, EventEmitter, HostListener, Input, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LineupData, MatchEvent } from '../../models/realMatch';
import { PlayerSearchItem } from '../../models/playerSearch';
import { PlayerItemComponent } from './player-item/player-item.component';
import { LineupPitchComponent } from './lineup-pitch/lineup-pitch.component';
import { MatchTeamHeaderComponent } from '../match-team-header/match-team-header.component';
import { MegaGoalService } from '../../services/megagoal.service';

type LineupSide = 'home' | 'away';
type LineupBucket = 'startXI' | 'substitutes';

interface LineupTeamRef {
  id: number;
  name: string;
  logo: string;
}

interface SideSearch {
  query: string;
  results: PlayerSearchItem[];
  loading: boolean;
}

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
  imports: [CommonModule, FormsModule, PlayerItemComponent, LineupPitchComponent, MatchTeamHeaderComponent],
  templateUrl: './match-lineups.component.html',
  styleUrl: './match-lineups.component.css'
})
export class MatchLineupsComponent implements OnDestroy {
  @Input() lineups: LineupData[] = [];
  @Input() events: MatchEvent[] = [];
  @Input() homeTeamId!: number;
  @Input() awayTeamId!: number;
  @Input() isAdmin = false;
  @Input() fixtureId = 0;
  @Input() homeTeam: LineupTeamRef | null = null;
  @Input() awayTeam: LineupTeamRef | null = null;
  @Output() lineupsChange = new EventEmitter<LineupData[]>();

  readonly editorSides: LineupSide[] = ['home', 'away'];
  readonly positionOptions = ['G', 'D', 'M', 'F'];
  editing = false;
  saving = false;
  saveError = '';
  draft: LineupData[] | null = null;
  replaceTarget: { side: LineupSide; bucket: LineupBucket; index: number } | null = null;
  editorSearch: Record<LineupSide, SideSearch> = {
    home: { query: '', results: [], loading: false },
    away: { query: '', results: [], loading: false },
  };

  private searchTimers: Partial<Record<LineupSide, ReturnType<typeof setTimeout>>> = {};
  private searchRequestIds: Record<LineupSide, number> = { home: 0, away: 0 };

  constructor(private megaGoal: MegaGoalService) {}

  ngOnDestroy(): void {
    for (const timer of Object.values(this.searchTimers)) {
      if (timer) clearTimeout(timer);
    }
  }

  getGoalCountsByPlayerId(): Record<number, number> {
    if (!this.events || this.events.length === 0) {
      return {};
    }

    const goalCounts: Record<number, number> = {};
    for (const event of this.events) {
      const type = (event.type || '').toLowerCase();
      const detail = (event.detail || '').toLowerCase();
      if (type === 'goal' && !detail.includes('missed penalty') && event.player?.id) {
        goalCounts[event.player.id] = (goalCounts[event.player.id] || 0) + 1;
      }
    }

    return goalCounts;
  }

  /** Assists from goal events (same source as match events timeline). */
  getAssistCountsByPlayerId(): Record<number, number> {
    if (!this.events || this.events.length === 0) {
      return {};
    }

    const assistCounts: Record<number, number> = {};
    for (const event of this.events) {
      const type = (event.type || '').toLowerCase();
      const detail = (event.detail || '').toLowerCase();
      if (type !== 'goal' || detail.includes('missed penalty')) {
        continue;
      }
      const assistId = event.assist?.id;
      if (assistId != null && assistId > 0) {
        assistCounts[assistId] = (assistCounts[assistId] || 0) + 1;
      }
    }

    return assistCounts;
  }

  getYellowCardCountsByPlayerId(): Record<number, number> {
    if (!this.events?.length) {
      return {};
    }

    const counts: Record<number, number> = {};
    for (const event of this.events) {
      const detail = (event.detail || '').toLowerCase();
      if (detail.includes('yellow card') && event.player?.id) {
        counts[event.player.id] = (counts[event.player.id] || 0) + 1;
      }
    }

    return counts;
  }

  getRedCardCountsByPlayerId(): Record<number, number> {
    if (!this.events?.length) {
      return {};
    }

    const counts: Record<number, number> = {};
    for (const event of this.events) {
      const detail = (event.detail || '').toLowerCase();
      if (detail.includes('red card') && event.player?.id) {
        counts[event.player.id] = (counts[event.player.id] || 0) + 1;
      }
    }

    return counts;
  }

  /** Players substituted off (`event.player` on substitution rows — same as events timeline). */
  getSubstitutedOutPlayerIds(): number[] {
    if (!this.events?.length) {
      return [];
    }

    const ids = new Set<number>();
    for (const event of this.events) {
      const type = (event.type || '').toLowerCase();
      const detail = (event.detail || '').toLowerCase();
      if (type === 'subst' || detail.includes('substitution')) {
        if (event.player?.id) {
          ids.add(event.player.id);
        }
      }
    }

    return Array.from(ids);
  }

  /** Players coming on (`assist` on substitution rows — same as events timeline). */
  getSubstitutedInPlayerIds(): number[] {
    if (!this.events?.length) {
      return [];
    }

    const ids = new Set<number>();
    for (const event of this.events) {
      const type = (event.type || '').toLowerCase();
      const detail = (event.detail || '').toLowerCase();
      if (type === 'subst' || detail.includes('substitution')) {
        const comingOnId = event.assist?.id;
        if (comingOnId != null && comingOnId > 0) {
          ids.add(comingOnId);
        }
      }
    }

    return Array.from(ids);
  }

  get shownLineups(): LineupData[] {
    return this.lineups || [];
  }

  getHomeLineup(): LineupData | undefined {
    return this.shownLineups.find(lineup => lineup.team.id === this.homeTeamId);
  }

  getAwayLineup(): LineupData | undefined {
    return this.shownLineups.find(lineup => lineup.team.id === this.awayTeamId);
  }

  lineupFor(side: LineupSide): LineupData {
    const source = this.draft ?? [];
    return (side === 'home'
      ? source.find(lineup => lineup.team.id === this.homeTeamId)
      : source.find(lineup => lineup.team.id === this.awayTeamId))!;
  }

  sideName(side: LineupSide): string {
    return side === 'home' ? (this.homeTeam?.name || 'Home') : (this.awayTeam?.name || 'Away');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.editing) this.closeEditor();
  }

  openEditor(): void {
    if (!this.isAdmin || this.editing) return;
    this.draft = this.ensureSides(this.lineups);
    this.replaceTarget = null;
    this.saveError = '';
    this.resetSearch();
    this.editing = true;
  }

  closeEditor(): void {
    if (this.saving) return;
    this.editing = false;
    this.draft = null;
    this.replaceTarget = null;
    this.saveError = '';
    this.resetSearch();
  }

  swapSides(): void {
    if (!this.draft) return;
    this.exchangeContent(this.draft);
  }

  swapTrainers(): void {
    if (!this.draft || this.draft.length < 2) return;
    const home = this.draft[0];
    const away = this.draft[1];
    const coach = home.coach;
    home.coach = away.coach;
    away.coach = coach;
  }

  save(): void {
    if (!this.draft) return;
    for (const lineup of this.draft) {
      this.refreshFormation(lineup);
    }
    this.persist(this.draft, true);
  }

  onPlayerQuery(side: LineupSide, value: string): void {
    const state = this.editorSearch[side];
    state.query = value;
    if (this.searchTimers[side]) clearTimeout(this.searchTimers[side]);
    const trimmed = value.trim();
    const requestId = ++this.searchRequestIds[side];
    if (!trimmed) {
      state.results = [];
      state.loading = false;
      return;
    }
    state.loading = true;
    this.searchTimers[side] = setTimeout(() => {
      this.megaGoal.searchPlayers(trimmed, { limit: 8 }).subscribe({
        next: (result) => {
          if (requestId !== this.searchRequestIds[side]) return;
          state.results = result.players || [];
          state.loading = false;
        },
        error: () => {
          if (requestId !== this.searchRequestIds[side]) return;
          state.results = [];
          state.loading = false;
        },
      });
    }, 250);
  }

  beginReplace(side: LineupSide, bucket: LineupBucket, index: number): void {
    this.replaceTarget = { side, bucket, index };
    this.editorSearch[side].query = '';
    this.editorSearch[side].results = [];
  }

  pickPlayer(side: LineupSide, player: PlayerSearchItem): void {
    const lineup = this.lineupFor(side);
    const target = this.replaceTarget;
    if (target && target.side === side) {
      const row = lineup[target.bucket][target.index];
      if (row) {
        row.player.id = player.id;
        row.player.name = player.name;
        row.player.pos = this.mapPosition(player.position) || row.player.pos;
      }
      this.replaceTarget = null;
    } else if (lineup.startXI.length < 11) {
      lineup.startXI.push({ player: this.newPlayer(player, false) });
      this.refreshFormation(lineup);
    } else {
      lineup.substitutes.push({ player: this.newPlayer(player, true) });
    }
    this.editorSearch[side].query = '';
    this.editorSearch[side].results = [];
  }

  removePlayer(side: LineupSide, bucket: LineupBucket, index: number): void {
    const lineup = this.lineupFor(side);
    lineup[bucket].splice(index, 1);
    if (bucket === 'startXI') this.refreshFormation(lineup);
  }

  movePlayer(side: LineupSide, bucket: LineupBucket, index: number): void {
    const lineup = this.lineupFor(side);
    const [row] = lineup[bucket].splice(index, 1);
    if (!row) return;
    if (bucket === 'startXI') {
      row.player.grid = null;
      lineup.substitutes.push(row);
      this.refreshFormation(lineup);
      return;
    }
    if (lineup.startXI.length >= 11) {
      lineup.substitutes.splice(index, 0, row);
      return;
    }
    lineup.startXI.push(row);
    this.refreshFormation(lineup);
  }

  onGridChange(side: LineupSide): void {
    this.refreshFormation(this.lineupFor(side));
  }

  private resetSearch(): void {
    for (const side of this.editorSides) {
      this.searchRequestIds[side] += 1;
      if (this.searchTimers[side]) clearTimeout(this.searchTimers[side]);
      this.editorSearch[side] = { query: '', results: [], loading: false };
    }
  }

  private persist(lineups: LineupData[], closeEditor: boolean): void {
    if (!this.fixtureId || this.saving) return;
    this.sanitize(lineups);
    this.saving = true;
    this.saveError = '';
    this.megaGoal.saveMatchLineups(this.fixtureId, lineups).subscribe({
      next: (result) => {
        this.saving = false;
        this.lineupsChange.emit(result.lineups);
        if (closeEditor) {
          this.editing = false;
          this.draft = null;
          this.replaceTarget = null;
        }
      },
      error: (err) => {
        this.saving = false;
        this.saveError = err?.error?.message || 'Could not save lineups.';
      },
    });
  }

  private ensureSides(source: LineupData[] | null | undefined): LineupData[] {
    const home = source?.find((lineup) => lineup.team.id === this.homeTeamId);
    const away = source?.find((lineup) => lineup.team.id === this.awayTeamId);
    return [
      this.normalizeLineup(home ? structuredClone(home) : this.emptyLineup('home')),
      this.normalizeLineup(away ? structuredClone(away) : this.emptyLineup('away')),
    ];
  }

  private normalizeLineup(lineup: LineupData): LineupData {
    lineup.startXI = lineup.startXI || [];
    lineup.substitutes = lineup.substitutes || [];
    for (const row of [...lineup.startXI, ...lineup.substitutes]) {
      row.player.pos = this.mapPosition(row.player.pos);
      if (row.player.number == null) row.player.number = 0;
      if (!row.player.grid) row.player.grid = null;
    }
    return lineup;
  }

  private sanitize(lineups: LineupData[]): void {
    for (const lineup of lineups) {
      lineup.team.logo = lineup.team.logo || '';
      this.normalizeLineup(lineup);
      for (const row of [...lineup.startXI, ...lineup.substitutes]) {
        row.player.number = Number(row.player.number);
        if (!Number.isFinite(row.player.number)) row.player.number = 0;
        const grid = (row.player.grid || '').trim();
        row.player.grid = grid || null;
      }
      this.refreshFormation(lineup);
    }
  }

  private emptyLineup(side: LineupSide): LineupData {
    const team = side === 'home' ? this.homeTeam : this.awayTeam;
    return {
      team: {
        id: team?.id || (side === 'home' ? this.homeTeamId : this.awayTeamId),
        name: team?.name || (side === 'home' ? 'Home' : 'Away'),
        logo: team?.logo || '',
      },
      startXI: [],
      substitutes: [],
    };
  }

  private exchangeContent(lineups: LineupData[]): void {
    const home = lineups[0];
    const away = lineups[1];
    const homeContent = {
      formation: home.formation,
      startXI: home.startXI,
      substitutes: home.substitutes,
      coach: home.coach,
    };
    home.formation = away.formation;
    home.startXI = away.startXI;
    home.substitutes = away.substitutes;
    home.coach = away.coach;
    away.formation = homeContent.formation;
    away.startXI = homeContent.startXI;
    away.substitutes = homeContent.substitutes;
    away.coach = homeContent.coach;
  }

  private refreshFormation(lineup: LineupData): void {
    const derived = this.formationFrom(lineup.startXI);
    if (derived) lineup.formation = derived;
  }

  private formationFrom(startXI: LineupData['startXI']): string | null {
    const counts = new Map<number, number>();
    for (const row of startXI) {
      const parsed = this.parseGrid(row.player.grid);
      if (!parsed) continue;
      counts.set(parsed.row, (counts.get(parsed.row) || 0) + 1);
    }
    const rows = [...counts.keys()].sort((a, b) => a - b);
    if (rows.length === 0) return null;
    const outfield = rows[0] === 1 && counts.get(1) === 1 ? rows.slice(1) : rows;
    if (outfield.length === 0) return null;
    return outfield.map((row) => String(counts.get(row))).join('-');
  }

  private newPlayer(player: PlayerSearchItem, bench: boolean): LineupPlayer {
    return {
      id: player.id,
      name: player.name,
      number: 0,
      pos: this.mapPosition(player.position),
      grid: bench ? null : null,
    };
  }

  private mapPosition(position?: string | null): string {
    const value = (position || '').trim().toLowerCase();
    if (value.startsWith('g')) return 'G';
    if (value.startsWith('d')) return 'D';
    if (value.startsWith('m')) return 'M';
    if (value.startsWith('f') || value.startsWith('a')) return 'F';
    return 'M';
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

  /**
   * @param mirrorColumnsInRow When true (home team pitch only), players in each row are ordered
   *   right-to-left by grid column so the XI mirrors on the horizontal axis.
   */
  getFieldRows(lineup: LineupData | undefined, mirrorColumnsInRow = false): FieldPlayer[][] {
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
      .map(([, rowPlayers]) => {
        const sorted = [...rowPlayers].sort((a, b) => a.col - b.col);
        return mirrorColumnsInRow ? sorted.reverse() : sorted;
      });
  }

  getUnplacedStartXI(lineup: LineupData | undefined): Array<{ player: LineupPlayer }> {
    if (!lineup) {
      return [];
    }

    return lineup.startXI.filter(({ player }) => !this.parseGrid(player.grid));
  }

  /** Bench players ordered G → D → M → F; unknown / empty `pos` last. */
  getSubstitutesSorted(lineup: LineupData): Array<{ player: LineupPlayer }> {
    if (!lineup.substitutes?.length) {
      return [];
    }

    return [...lineup.substitutes].sort(
      (a, b) => this.substitutePositionOrder(a.player.pos) - this.substitutePositionOrder(b.player.pos)
    );
  }

  private substitutePositionOrder(pos: string | null | undefined): number {
    const raw = (pos ?? '').trim().toUpperCase();
    if (!raw) {
      return 99;
    }

    if (raw.startsWith('GK') || raw === 'G' || raw.startsWith('GOALKEEP')) {
      return 0;
    }
    if (raw.startsWith('D') || raw.includes('DEF')) {
      return 1;
    }
    if (raw.startsWith('M') || raw.includes('MID')) {
      return 2;
    }
    if (raw.startsWith('F') || raw.includes('FORW') || raw.includes('ATT')) {
      return 3;
    }

    const c = raw.charAt(0);
    if (c === 'G') {
      return 0;
    }
    if (c === 'D') {
      return 1;
    }
    if (c === 'M') {
      return 2;
    }
    if (c === 'F') {
      return 3;
    }

    return 99;
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
