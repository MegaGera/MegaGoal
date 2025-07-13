import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeneralStats } from '../../../models/generalStats';
import { MiniStatCardComponent } from '../mini-stat-card/mini-stat-card.component';
import { GeneralCardComponent } from '../../general-card/general-card.component';

@Component({
  selector: 'app-general-stats',
  standalone: true,
  imports: [CommonModule, MiniStatCardComponent, GeneralCardComponent],
  templateUrl: './general-stats.component.html',
  styleUrls: ['./general-stats.component.css']
})
export class GeneralStatsComponent {
  @Input() generalStats: GeneralStats | null = null;
  @Input() generalStatsLoaded: boolean = false;

  getMatchSubvalueForCard(match: any): string {
    const totalGoals = match.goals.home + match.goals.away;
    return `Total goals: ${totalGoals}`;
  }
} 