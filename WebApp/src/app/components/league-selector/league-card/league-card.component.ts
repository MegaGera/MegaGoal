import { Component, Input, Output, EventEmitter } from '@angular/core';
import { League } from '../../../models/league';
import { ImagesService } from '../../../services/images.service';

@Component({
  selector: 'app-league-card',
  standalone: true,
  imports: [],
  templateUrl: './league-card.component.html',
  styleUrl: './league-card.component.css'
})
export class LeagueCardComponent {
  @Input() league!: League;
  @Input() viewCount: number | null = null;
  @Output() leagueSelected = new EventEmitter<League>();

  constructor(public images: ImagesService) {}

  selectLeague(): void {
    this.leagueSelected.emit(this.league);
  }
}
