import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  QueryList,
  SimpleChanges,
  ViewChildren
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MegaGoalService } from '../../services/megagoal.service';
import { MatchUserPicks, MatchPlayerPick, PlayerPickKey } from '../../models/match';
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
  @Output() userPicksChange = new EventEmitter<MatchUserPicks | undefined>();

  @ViewChildren('playerPickList') playerPickLists!: QueryList<ElementRef<HTMLElement>>;

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
    this.rating = value;
    this.persist({ rating: value });
  }

  onPlayerPickSelect(key: PlayerPickKey, playerId: number): void {
    const current = this.selectedPlayerIds[key];
    const nextId = current === playerId ? null : playerId;
    this.selectedPlayerIds[key] = nextId;
    this.displayLists[key] = this.orderPlayersForDisplay(this.participants, nextId);
    this.persist({ [key]: this.playerIdToPick(nextId) });
    this.scrollListToStart(key);
  }

  isPlayerSelected(key: PlayerPickKey, playerId: number): boolean {
    return this.selectedPlayerIds[key] === playerId;
  }

  getDisplayList(key: PlayerPickKey): ParticipantPlayer[] {
    return this.displayLists[key];
  }

  clearRating(): void {
    this.rating = null;
    this.persist({ rating: null });
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
      this.displayLists[section.key] = this.orderPlayersForDisplay(
        this.participants,
        this.selectedPlayerIds[section.key]
      );
    }
  }

  private orderPlayersForDisplay(
    players: ParticipantPlayer[],
    selectedId: number | null
  ): ParticipantPlayer[] {
    if (selectedId == null) {
      return [...players];
    }
    const selected = players.find((p) => p.id === selectedId);
    if (!selected) {
      return [...players];
    }
    return [selected, ...players.filter((p) => p.id !== selectedId)];
  }

  private scrollListToStart(key: PlayerPickKey): void {
    requestAnimationFrame(() => {
      const listRef = this.playerPickLists?.find(
        (ref) => ref.nativeElement.dataset['pick'] === key
      );
      listRef?.nativeElement.scrollTo({ left: 0, behavior: 'smooth' });
    });
  }

  private playerIdToPick(playerId: number | null): MatchPlayerPick | null {
    if (playerId == null) {
      return null;
    }
    const player = this.participants.find((p) => p.id === playerId);
    return player ?? null;
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
