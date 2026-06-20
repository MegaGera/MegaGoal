import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MegaGoalService } from '../../services/megagoal.service';
import {
  MatchPlayerVoteCount,
  MatchUserPicks,
  MatchPlayerPick,
  PlayerPickKey
} from '../../models/match';
import { RealMatch } from '../../models/realMatch';
import { MatchPlayerPickCardComponent } from '../match-info/match-player-pick-card/match-player-pick-card.component';

interface ParticipantPlayer extends MatchPlayerPick {}

interface PlayerPickSection {
  key: PlayerPickKey;
  label: string;
}

@Component({
  selector: 'app-match-user-picks',
  standalone: true,
  imports: [CommonModule, MatchPlayerPickCardComponent],
  templateUrl: './match-user-picks.component.html',
  styleUrl: './match-user-picks.component.css'
})
export class MatchUserPicksComponent implements OnChanges {
  @Input() realMatch!: RealMatch;
  @Input() fixtureId!: number;
  @Input() userPicks: MatchUserPicks | undefined;
  @Input() layout: 'stacked' | 'horizontal' = 'stacked';
  @Input() overallRating: number | null = null;
  @Input() playerVotes: Record<PlayerPickKey, MatchPlayerVoteCount[]> | null = null;
  @Input() watched = false;
  @Output() userPicksChange = new EventEmitter<MatchUserPicks | undefined>();
  @Output() ensureWatched = new EventEmitter<() => void>();

  readonly playerPickSections: PlayerPickSection[] = [
    { key: 'mvp', label: '🏆 MVP' },
    { key: 'bluff', label: '🤡 Bluff' },
    { key: 'underrated', label: '⭐ Underrated' },
    { key: 'most_entertaining', label: '🔥 Most Entertaining' }
  ];

  rating: number | null = null;
  hoverRating: number | null = null;
  selectedPlayerIds: Record<PlayerPickKey, number | null> = {
    mvp: null,
    bluff: null,
    underrated: null,
    most_entertaining: null
  };
  displayLists: Record<PlayerPickKey, ParticipantPlayer[]> = {
    mvp: [],
    bluff: [],
    underrated: [],
    most_entertaining: []
  };
  participants: ParticipantPlayer[] = [];
  readonly starIndexes = [1, 2, 3, 4, 5];
  saving = false;
  hasLineups = false;

  constructor(private megaGoal: MegaGoalService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['realMatch'] || changes['userPicks']) {
      this.participants = this.buildParticipants();
      this.hasLineups = (this.realMatch?.lineups?.length ?? 0) > 0;
      this.syncFromInput();
      this.rebuildDisplayLists();
    } else if (changes['playerVotes']) {
      this.rebuildDisplayLists();
    }
  }

  private syncFromInput(): void {
    this.rating = this.userPicks?.rating ?? null;
    for (const section of this.playerPickSections) {
      this.selectedPlayerIds[section.key] = this.getPickId(this.userPicks, section.key);
    }
  }

  private getPickId(picks: MatchUserPicks | undefined, key: PlayerPickKey): number | null {
    if (!picks) {
      return null;
    }
    if (key === 'bluff') {
      const legacyWorst = (picks as MatchUserPicks & { worst?: MatchPlayerPick }).worst;
      return picks.bluff?.id ?? legacyWorst?.id ?? null;
    }
    return picks[key]?.id ?? null;
  }

  onRatingChange(value: number | null): void {
    this.withWatchedGuard(() => {
      this.rating = value;
      this.persist({ rating: value });
    });
  }

  onPlayerPickSelect(key: PlayerPickKey, playerId: number): void {
    this.withWatchedGuard(() => {
      const current = this.selectedPlayerIds[key];
      const nextId = current === playerId ? null : playerId;
      this.selectedPlayerIds[key] = nextId;
      this.rebuildDisplayLists();
      this.persist({ [key]: this.playerIdToPick(nextId) });
    });
  }

  isPlayerSelected(key: PlayerPickKey, playerId: number): boolean {
    return this.selectedPlayerIds[key] === playerId;
  }

  getDisplayList(key: PlayerPickKey): ParticipantPlayer[] {
    return this.displayLists[key];
  }

  getPlayerVotePercent(key: PlayerPickKey, playerId: number): number | null {
    const votes = this.getVoteCountMap(key).get(playerId) ?? 0;
    if (votes <= 0) {
      return null;
    }
    const total = this.getSectionTotalVotes(key);
    if (total <= 0) {
      return null;
    }
    return Math.round((votes / total) * 100);
  }

  formatOverallRating(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  }

  clearRating(): void {
    this.withWatchedGuard(() => {
      this.rating = null;
      this.persist({ rating: null });
    });
  }

  get displayRating(): number | null {
    return this.hoverRating ?? this.rating;
  }

  getStarFillPercent(star: number): number {
    const value = this.displayRating;
    if (value == null) {
      return 0;
    }
    if (value >= star) {
      return 100;
    }
    if (value >= star - 0.5) {
      return 50;
    }
    return 0;
  }

  onStarHover(star: number, half: 'left' | 'right'): void {
    this.hoverRating = half === 'left' ? star - 0.5 : star;
  }

  clearStarHover(): void {
    this.hoverRating = null;
  }

  setRatingFromStar(star: number, half: 'left' | 'right'): void {
    const value = half === 'left' ? star - 0.5 : star;
    if (this.rating === value) {
      this.clearRating();
      return;
    }
    this.onRatingChange(value);
  }

  trackByPlayerId(_index: number, player: ParticipantPlayer): number {
    return player.id;
  }

  trackByPickKey(_index: number, section: PlayerPickSection): PlayerPickKey {
    return section.key;
  }

  private rebuildDisplayLists(): void {
    for (const section of this.playerPickSections) {
      this.displayLists[section.key] = this.orderPlayersForDisplay(section.key);
    }
  }

  private orderPlayersForDisplay(key: PlayerPickKey): ParticipantPlayer[] {
    const voteMap = this.getVoteCountMap(key);
    const selectedId = this.selectedPlayerIds[key];
    const sorted = [...this.participants].sort((a, b) => {
      const voteDiff = (voteMap.get(b.id) ?? 0) - (voteMap.get(a.id) ?? 0);
      if (voteDiff !== 0) {
        return voteDiff;
      }
      if (a.team_id !== b.team_id) {
        return a.team_id - b.team_id;
      }
      return a.name.localeCompare(b.name);
    });

    if (selectedId == null) {
      return sorted;
    }

    const selected = sorted.find((player) => player.id === selectedId);
    if (!selected) {
      return sorted;
    }

    return [selected, ...sorted.filter((player) => player.id !== selectedId)];
  }

  private getSectionTotalVotes(key: PlayerPickKey): number {
    return (this.playerVotes?.[key] ?? []).reduce((sum, entry) => sum + entry.votes, 0);
  }

  private getVoteCountMap(key: PlayerPickKey): Map<number, number> {
    const map = new Map<number, number>();
    for (const entry of this.playerVotes?.[key] ?? []) {
      map.set(entry.id, entry.votes);
    }
    return map;
  }

  private playerIdToPick(playerId: number | null): MatchPlayerPick | null {
    if (playerId == null) {
      return null;
    }
    const player = this.participants.find((p) => p.id === playerId);
    return player ?? null;
  }

  private withWatchedGuard(action: () => void): void {
    if (!this.watched) {
      this.ensureWatched.emit(action);
      return;
    }
    action();
  }

  private persist(patch: Partial<MatchUserPicks>): void {
    if (!this.fixtureId || this.saving) {
      return;
    }

    this.saving = true;

    this.megaGoal.setUserPicks(this.fixtureId, patch).subscribe({
      next: (result) => {
        this.saving = false;
        const next = result.user_picks ?? undefined;
        this.userPicksChange.emit(next);
        if (next) {
          this.rating = next.rating ?? null;
          for (const section of this.playerPickSections) {
            this.selectedPlayerIds[section.key] = this.getPickId(next, section.key);
          }
        } else {
          this.rating = null;
          for (const section of this.playerPickSections) {
            this.selectedPlayerIds[section.key] = null;
          }
        }
        this.rebuildDisplayLists();
      },
      error: () => {
        this.saving = false;
        this.syncFromInput();
        this.rebuildDisplayLists();
      }
    });
  }

  private buildParticipants(): ParticipantPlayer[] {
    if (!this.realMatch?.lineups?.length) {
      return [];
    }

    const byId = new Map<number, ParticipantPlayer>();

    const addPlayer = (
      id: number | null | undefined,
      name: string | null | undefined,
      teamId: number,
      teamName: string
    ): void => {
      if (id == null || id <= 0 || !name) {
        return;
      }
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          name,
          team_id: teamId,
          team_name: teamName
        });
      }
    };

    for (const lineup of this.realMatch.lineups) {
      const teamId = lineup.team.id;
      const teamName = lineup.team.name;
      for (const entry of lineup.startXI ?? []) {
        addPlayer(entry.player?.id, entry.player?.name, teamId, teamName);
      }
    }

    for (const event of this.realMatch.events ?? []) {
      const type = (event.type || '').toLowerCase();
      if (type !== 'subst') {
        continue;
      }
      const teamId = event.team?.id;
      const teamName = event.team?.name ?? '';
      if (teamId == null) {
        continue;
      }
      addPlayer(event.assist?.id ?? null, event.assist?.name ?? null, teamId, teamName);
    }

    return Array.from(byId.values()).sort((a, b) => {
      if (a.team_id !== b.team_id) {
        return a.team_id - b.team_id;
      }
      return a.name.localeCompare(b.name);
    });
  }
}
