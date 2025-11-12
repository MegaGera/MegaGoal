import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { Player } from '../../../models/player';
import { ImagesService } from '../../../services/images.service';

@Component({
  selector: 'app-player-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player-header.component.html',
  styleUrl: './player-header.component.css'
})
export class PlayerHeaderComponent {
  @Input({ required: true }) player!: Player;
  @Input() playerAge: number | null = null;
  @Input() playerBirthPlace: string | null = null;

  constructor(public images: ImagesService) {}

  getPlayerImageUrl(): string {
    return this.images.getRouteImagePlayer(this.player.player.id);
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = 'assets/img/default-player.png';
    }
  }

  hasBasicInfo(): boolean {
    return !!(this.player?.player?.position || this.player?.player?.number);
  }

  hasMetaInfo(): boolean {
    return !!(
      this.player?.player?.nationality ||
      this.playerBirthPlace ||
      this.playerAge !== null
    );
  }
}

