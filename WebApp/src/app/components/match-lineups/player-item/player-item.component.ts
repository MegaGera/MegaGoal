import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-player-item',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './player-item.component.html',
  styleUrl: './player-item.component.css'
})
export class PlayerItemComponent {
  @Input() player!: {
    id: number;
    name: string;
    number: number;
    pos: string;
    grid: string | null;
  };
  @Input() isSubstitute: boolean = false;

  getPlayerImageUrl(playerId: number): string {
    return `https://media.api-sports.io/football/players/${playerId}.png`;
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = 'assets/img/default-player.png';
    }
  }
}

