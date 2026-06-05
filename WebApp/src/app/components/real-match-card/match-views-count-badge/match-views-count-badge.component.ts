import { Component, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltip, MatTooltipModule } from '@angular/material/tooltip';

export type MatchViewsBadgeLayout = 'default' | 'matchInfo';

/**
 * Small squared label for global watched-user count. Tooltip on hover; tap shows it on touch devices.
 */
@Component({
  selector: 'app-match-views-count-badge',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  templateUrl: './match-views-count-badge.component.html',
  styleUrl: './match-views-count-badge.component.css',
})
export class MatchViewsCountBadgeComponent {
  @Input() count = 0;
  /** When true, tooltip for pre-kickoff; otherwise global count from other users */
  @Input() notStarted = false;
  /** Larger typography on desktop for match-info header card */
  @Input() layout: MatchViewsBadgeLayout = 'default';

  @ViewChild('viewsTip') private viewsTip?: MatTooltip;

  get resolvedTooltip(): string {
    return this.notStarted ? 'Users waiting' : 'Users watched';
  }

  onBadgeClick(ev: Event): void {
    ev.stopPropagation();
    ev.preventDefault();
    if (typeof window === 'undefined' || !this.viewsTip) {
      return;
    }
    if (window.matchMedia('(pointer: coarse)').matches) {
      this.viewsTip.show();
      window.setTimeout(() => this.viewsTip?.hide(), 2300);
    }
  }
}
