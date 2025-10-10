import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { jamFilterF } from '@ng-icons/jam-icons';
import { SeasonInfo } from '../../models/season';
import { ImagesService } from '../../services/images.service';
import { GeneralCardComponent } from '../general-card/general-card.component';

@Component({
  selector: 'app-team-filters',
  standalone: true,
  imports: [
    CommonModule,
    NgOptimizedImage,
    FormsModule,
    NgIconComponent,
    GeneralCardComponent
  ],
  templateUrl: './team-filters.component.html',
  styleUrls: ['./team-filters.component.css'],
  providers: [ImagesService, provideIcons({ jamFilterF })]
})
export class TeamFiltersComponent {
  @Input() selectedSeason!: SeasonInfo;
  @Input() seasons: SeasonInfo[] = [];
  @Input() leagues: string[] = [];
  @Input() selectedLeagues: string[] = [];
  @Input() leagueNames: Map<string, string> = new Map();

  @Output() seasonChange = new EventEmitter<SeasonInfo>();
  @Output() leagueToggle = new EventEmitter<string>();

  constructor(public images: ImagesService) {}

  getLeagueName(leagueId: string): string {
    return this.leagueNames.get(leagueId) || `League ${leagueId}`;
  }

  onSeasonChange(season: SeasonInfo) {
    this.seasonChange.emit(season);
  }

  onLeagueToggle(league: string) {
    this.leagueToggle.emit(league);
  }
}

