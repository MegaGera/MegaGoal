import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MegaGoalService } from '../../../services/megagoal.service';
import { MATCH_REACTIONS, MatchReaction } from '../../../models/match';

@Component({
  selector: 'app-match-reactions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './match-reactions.component.html',
  styleUrl: './match-reactions.component.css'
})
export class MatchReactionsComponent implements OnChanges {
  @Input() fixtureId!: number;
  @Input() reactions: MatchReaction[] | undefined;
  @Output() reactionsChange = new EventEmitter<MatchReaction[] | undefined>();
  @Output() firstReactionAdded = new EventEmitter<void>();

  readonly matchReactions = MATCH_REACTIONS;
  selectedReactions = new Set<MatchReaction>();
  saving = false;

  constructor(private megaGoal: MegaGoalService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['reactions']) {
      this.selectedReactions = new Set(this.reactions ?? []);
    }
  }

  isReactionSelected(reaction: MatchReaction): boolean {
    return this.selectedReactions.has(reaction);
  }

  toggleReaction(reaction: MatchReaction): void {
    const wasEmpty = this.selectedReactions.size === 0;
    const next = new Set(this.selectedReactions);
    if (next.has(reaction)) {
      next.delete(reaction);
    } else {
      next.add(reaction);
    }
    this.selectedReactions = next;
    this.persistReactions([...next], wasEmpty && next.size > 0);
  }

  trackByReaction(_index: number, reaction: MatchReaction): string {
    return reaction;
  }

  private persistReactions(reactions: MatchReaction[], isFirstAdd: boolean): void {
    if (!this.fixtureId || this.saving) {
      return;
    }

    this.saving = true;

    this.megaGoal.setReactions(this.fixtureId, reactions).subscribe({
      next: (result) => {
        this.saving = false;
        const next = result.reactions ?? undefined;
        this.reactionsChange.emit(next);
        this.selectedReactions = new Set(next ?? []);
        if (isFirstAdd && (next?.length ?? 0) > 0) {
          this.firstReactionAdded.emit();
        }
      },
      error: () => {
        this.saving = false;
        this.selectedReactions = new Set(this.reactions ?? []);
      }
    });
  }
}
