import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TeamStatistics } from '../../models/realMatch';
import { ImagesService } from '../../services/images.service';

@Component({
  selector: 'app-match-statistics',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './match-statistics.component.html',
  styleUrl: './match-statistics.component.css'
})
export class MatchStatisticsComponent {
  @Input() homeStatistics!: TeamStatistics;
  @Input() awayStatistics!: TeamStatistics;
  @Input() isAdmin: boolean = false;
  @Input() isFinished: boolean = false;
  @Input() isUpdating: boolean = false;
  @Output() updateStatistics = new EventEmitter<void>();

  constructor(public images: ImagesService) {}

  getStatValue(statistics: TeamStatistics, type: string): string | number {
    if (!statistics) return '-';
    const stat = statistics.statistics.find(s => s.type === type);
    return stat?.value ?? '-';
  }

  getStatPercentage(statistics: TeamStatistics, type: string): number {
    const value = this.getStatValue(statistics, type);
    if (typeof value === 'string' && value.includes('%')) {
      return parseInt(value);
    }
    return 0;
  }

  getStatNumber(statistics: TeamStatistics, type: string): number {
    const value = this.getStatValue(statistics, type);
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string' && !value.includes('%') && !isNaN(Number(value))) {
      return Number(value);
    }
    return 0;
  }

  isPercentageStat(statistics: TeamStatistics, type: string): boolean {
    const value = this.getStatValue(statistics, type);
    return typeof value === 'string' && value.toString().includes('%');
  }

  isNumericStat(statistics: TeamStatistics, type: string): boolean {
    const value = this.getStatValue(statistics, type);
    if (typeof value === 'number') return true;
    if (typeof value === 'string' && !value.includes('%') && !isNaN(Number(value))) return true;
    return false;
  }

  getMaxValue(type: string): number {
    const homeVal = this.getStatNumber(this.homeStatistics, type);
    const awayVal = this.getStatNumber(this.awayStatistics, type);
    return Math.max(homeVal, awayVal, 1);
  }

  getBarPercentage(statistics: TeamStatistics, type: string): number {
    if (this.isPercentageStat(statistics, type)) {
      return this.getStatPercentage(statistics, type);
    }
    if (this.isNumericStat(statistics, type)) {
      const value = this.getStatNumber(statistics, type);
      const max = this.getMaxValue(type);
      return (value / max) * 100;
    }
    return 0;
  }

  onUpdateStatistics(): void {
    this.updateStatistics.emit();
  }
}
