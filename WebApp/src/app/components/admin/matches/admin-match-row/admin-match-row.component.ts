import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RealMatch } from '../../../../models/realMatch';

@Component({
  selector: 'app-admin-match-row',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-match-row.component.html',
  styleUrl: './admin-match-row.component.css'
})
export class AdminMatchRowComponent {
  @Input() match!: RealMatch;
  @Input() isMarkedForLanding: boolean = false;
  @Input() isUpdating: boolean = false;
  @Input() isUpdatingLineups: boolean = false;
  @Input() isUpdatingEvents: boolean = false;
  @Input() isMarking: boolean = false;
  @Input() showStatsBadge: boolean = true;
  @Input() showUpdateButton: boolean = true;
  @Input() showLandingButton: boolean = true;

  @Output() updateStatistics = new EventEmitter<RealMatch>();
  @Output() updateLineups = new EventEmitter<RealMatch>();
  @Output() updateEvents = new EventEmitter<RealMatch>();
  @Output() toggleLanding = new EventEmitter<RealMatch>();

  hasStatistics(): boolean {
    return Array.isArray((this.match as any).statistics) && ((this.match as any).statistics as any[]).length > 0;
  }

  hasLineups(): boolean {
    return Array.isArray((this.match as any).lineups) && ((this.match as any).lineups as any[]).length > 0;
  }

  hasEvents(): boolean {
    return Array.isArray((this.match as any).events) && ((this.match as any).events as any[]).length > 0;
  }

  isNotStarted(): boolean {
    const status = this.match.fixture.status?.short;
    return status === 'TBD' || status === 'NS' || status === 'SUSP' || status === 'PST' || status === 'CANC' || status === 'ABD' || status === 'AWD' || status === 'WO';
  }

  onUpdateStatistics(): void {
    this.updateStatistics.emit(this.match);
  }

  onUpdateLineups(): void {
    this.updateLineups.emit(this.match);
  }

  onUpdateEvents(): void {
    this.updateEvents.emit(this.match);
  }

  onToggleLanding(): void {
    this.toggleLanding.emit(this.match);
  }
}

