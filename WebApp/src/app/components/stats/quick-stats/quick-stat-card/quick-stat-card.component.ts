import { Component, Input } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { ImagesService } from '../../../../services/images.service';

interface StatCard {
  value: number | string;
  label: string;
  subtitle?: string;
  teamId?: number;
  leagueId?: number;
  icon?: string;
}

@Component({
  selector: 'app-quick-stat-card',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage],
  templateUrl: './quick-stat-card.component.html',
  styleUrl: './quick-stat-card.component.css'
})
export class QuickStatCardComponent {
  @Input() card: StatCard = { value: 0, label: '' };

  constructor(public images: ImagesService) {}
} 