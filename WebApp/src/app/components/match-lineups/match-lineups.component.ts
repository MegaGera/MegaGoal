import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LineupData } from '../../models/realMatch';
import { ImagesService } from '../../services/images.service';
import { PlayerItemComponent } from './player-item/player-item.component';

@Component({
  selector: 'app-match-lineups',
  standalone: true,
  imports: [CommonModule, RouterLink, PlayerItemComponent],
  templateUrl: './match-lineups.component.html',
  styleUrl: './match-lineups.component.css'
})
export class MatchLineupsComponent {
  @Input() lineups!: LineupData[];
  @Input() homeTeamId!: number;
  @Input() awayTeamId!: number;

  constructor(public images: ImagesService) {}

  getHomeLineup(): LineupData | undefined {
    return this.lineups?.find(lineup => lineup.team.id === this.homeTeamId);
  }

  getAwayLineup(): LineupData | undefined {
    return this.lineups?.find(lineup => lineup.team.id === this.awayTeamId);
  }
}
