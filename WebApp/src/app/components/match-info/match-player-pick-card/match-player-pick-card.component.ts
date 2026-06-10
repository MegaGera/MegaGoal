import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImagesService } from '../../../services/images.service';

@Component({
  selector: 'app-match-player-pick-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './match-player-pick-card.component.html',
  styleUrl: './match-player-pick-card.component.css',
  providers: [ImagesService]
})
export class MatchPlayerPickCardComponent implements OnChanges {
  @Input() playerId!: number;
  @Input() playerName!: string;
  @Input() teamId!: number;
  @Input() selected = false;
  @Input() votePercent: number | null = null;
  @Output() cardClick = new EventEmitter<void>();

  avatarError = false;

  constructor(public images: ImagesService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['playerId']) {
      this.avatarError = false;
    }
  }

  onAvatarError(): void {
    this.avatarError = true;
  }

  onClick(): void {
    this.cardClick.emit();
  }
}
