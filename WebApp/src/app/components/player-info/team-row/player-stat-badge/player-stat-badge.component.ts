import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-player-stat-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player-stat-badge.component.html',
  styleUrl: './player-stat-badge.component.css'
})
export class PlayerStatBadgeComponent {
  @Input() icon!: string;
  @Input() value!: number | string;
}

