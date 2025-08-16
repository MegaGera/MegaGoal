import { Component, Input, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule, NgClass, NgOptimizedImage } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { jamFilterF, jamChevronUp, jamChevronDown } from '@ng-icons/jam-icons';
import { SeasonInfo } from '../../models/season';
import { LeagueStats } from '../../models/league';
import { Location } from '../../models/location';
import { ImagesService } from '../../services/images.service';
import { GeneralCardComponent } from '../general-card/general-card.component';
import { NATIONS_LEAGUE_IDS } from '../../config/topLeagues';

@Component({
  selector: 'app-filters-home',
  standalone: true,
  imports: [
    CommonModule, 
    NgClass, 
    NgOptimizedImage, 
    MatChipsModule, 
    FormsModule, 
    NgIconComponent, 
    GeneralCardComponent
  ],
  templateUrl: './filters-home.component.html',
  styleUrls: ['./filters-home.component.css'],
  providers: [ImagesService, provideIcons({ jamFilterF, jamChevronUp, jamChevronDown })]
})
export class FiltersHomeComponent {
  @Input() filterPanelChipSelected: number = 1;
  @Input() filterLeagueSelected: number[] = [];
  @Input() filterSeasonSelected!: SeasonInfo;
  @Input() filterLocationSelected: string = '';
  @Input() seasons: SeasonInfo[] = [];
  @Input() locations: Location[] = [];
  @Input() leaguesViewed: LeagueStats[] = [];
  @Input() leaguesLoaded: boolean = false;

  @Output() filterPanelChipSelectedChange = new EventEmitter<number>();
  @Output() filterLeagueSelectedChange = new EventEmitter<number[]>();
  @Output() filterSeasonSelectedChange = new EventEmitter<SeasonInfo>();
  @Output() filterLocationSelectedChange = new EventEmitter<string>();
  @Output() resetFiltersChange = new EventEmitter<void>();

  showAllLeagues = false;

  constructor(public images: ImagesService) {}

  // Computed property to reorder leagues by selection (leagues are already filtered by parent)
  get filteredLeagues(): LeagueStats[] {
    // Reorder: selected leagues first, then non-selected leagues
    const selectedLeagues = this.leaguesViewed.filter(league => this.filterLeagueSelected.includes(league.league_id));
    const nonSelectedLeagues = this.leaguesViewed.filter(league => !this.filterLeagueSelected.includes(league.league_id));
    
    const reorderedLeagues = [...selectedLeagues, ...nonSelectedLeagues];
    
    // If not showing all leagues, limit to first 4
    return this.showAllLeagues ? reorderedLeagues : reorderedLeagues.slice(0, 4);
  }

  changeFilterPanelChipSelected(chip: number) {
    this.filterPanelChipSelected = chip;
    this.filterPanelChipSelectedChange.emit(chip);
  }

  changeFilterLeagueSelected(league: number) {
    let newFilterLeagueSelected: number[];
    if (this.filterLeagueSelected.includes(league)) {
      newFilterLeagueSelected = this.filterLeagueSelected.filter(item => item !== league);
    } else {
      newFilterLeagueSelected = [...this.filterLeagueSelected, league];
    }
    this.filterLeagueSelected = newFilterLeagueSelected;
    this.filterLeagueSelectedChange.emit(newFilterLeagueSelected);
  }

  changeFilterSeasonSelected(season: SeasonInfo) {
    this.filterSeasonSelected = season;
    this.filterSeasonSelectedChange.emit(season);
  }

  changeFilterLocationSelected(location: string) {
    this.filterLocationSelected = location;
    this.filterLocationSelectedChange.emit(location);
  }

  toggleLeaguesVisibility() {
    this.showAllLeagues = !this.showAllLeagues;
  }

  resetFilters() {
    this.resetFiltersChange.emit();
  }
} 