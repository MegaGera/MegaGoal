import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TeamStatsBadgeComponent } from '../team-stats-badge/team-stats-badge.component';

@Component({
  selector: 'app-team-stats-list',
  standalone: true,
  imports: [TeamStatsBadgeComponent, CommonModule],
  templateUrl: './team-stats-list.component.html',
  styleUrl: './team-stats-list.component.css'
})
export class TeamStatsListComponent {
  @Input() teams!: any[];
}
