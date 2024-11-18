import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select'
import { FormsModule } from '@angular/forms';

import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamFilterF } from '@ng-icons/jam-icons';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { Match } from '../../models/match';
import { Location } from '../../models/location';
import { SeasonInfo } from '../../models/season';
import { RealMatchCardComponent } from '../real-match-card/real-match-card.component';
import { PaginationComponent } from '../pagination/pagination.component';
import { StatsService } from '../../services/stats.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, NgIconComponent, CommonModule, RealMatchCardComponent, PaginationComponent, MatProgressSpinnerModule, 
    MatExpansionModule, MatChipsModule, MatSelectModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  providers: [ImagesService, provideNgIconsConfig({
    size: '1.5em',
  }), provideIcons({ jamFilterF })]
})
export class HomeComponent implements OnInit {

  readonly panelOpenState = signal(false);

  /* 
    Array of matches
  */
  matches: Match[] = [];
  matchesOriginal: Match[] = [];
  matchesLoaded: boolean = false;
  matchesPerPage: number = 20;
  matchesFiltered: Match[] = [];
  locations: Location[] = [];
  stats: { teamsViewed: any[] } = { teamsViewed: []};
  filterPanelChipSelected: number = 1; // 0 All, 1 Watched, 2 Not Watched
  filterLeagueSelected: number[] = []; // 40: Premier League, 140: La Liga, 141: La Liga 2, 2: Champions League

  /* Seasons */
  seasons: SeasonInfo[] = 
    [{id: 0, text: "All time"}, 
    {id: 2024, text: "2024-2025"}, 
    {id: 2023, text: "2023-2024"}, 
    {id: 2022, text: "2022-2023"}, 
    {id: 2021 ,text: "2021-2022"}, 
    {id: 2020, text: "2020-2021"}, 
    {id: 2019, text: "2019-2020"}, 
    {id: 2018, text: "2018-2019"}, 
    {id: 2017, text: "2017-2018"}, 
    {id: 2016, text: "2016-2017"}, 
    {id: 2015, text: "2015-2016"}, 
    {id: 2014, text: "2014-2015"}]
  seasonsFiltered: SeasonInfo[] = [];
  filterSeasonSelected!: SeasonInfo;

  constructor(private megagoal: MegaGoalService, public images: ImagesService, private changeDetectorRef: ChangeDetectorRef,
    private statsService: StatsService) { }

  ngOnInit(): void {
    this.filterSeasonSelected = this.seasons[0];
    this.getAllMatches();
    this.getLocations();
  }

  /* 
    Get all matches from the service
  */
  getAllMatches() {
    this.megagoal.getAllMatches().subscribe(result => {
      this.matchesOriginal = <Match[]>result;
      this.matchesOriginal.sort(function(x, y){
        return y.fixture.timestamp - x.fixture.timestamp;
      })
      this.changeDetectorRef.detectChanges();
      this.matchesLoaded = true;
      this.filterMatches();
    })
  }

  getLocations() {
    this.megagoal.getLocations().subscribe(result => {
      this.locations = <Location[]>result;
    })
  }

  getStats() {
    this.statsService.getTeamsViewed(this.filterPanelChipSelected, this.filterLeagueSelected, this.filterSeasonSelected.id).subscribe(result => {
      this.stats.teamsViewed = result;
    })
  }

  filterMatches() {

    // First: Take all the matches
    this.matches = this.matchesOriginal;

    // Filter by team selection
    if (this.filterPanelChipSelected == 1) {
      this.matches = this.matches.filter(match => match.league.id != 10 && match.league.id != 1 && match.league.id != 4 && match.league.id != 9 && match.league.id != 5);
    } else if (this.filterPanelChipSelected == 2) {
      this.matches = this.matches.filter(match => match.league.id == 10 || match.league.id == 1 || match.league.id == 4 || match.league.id == 9 || match.league.id == 5);
    }

    // Filter by league selection
    if (this.filterLeagueSelected.length > 0) {
      this.matches = this.matches.filter(match => this.filterLeagueSelected.includes(match.league.id));
    }

    // Filter by season
    if (this.filterSeasonSelected.id != 0) {
      this.matches = this.matches.filter(match => match.league.season == this.filterSeasonSelected.id);
    }

    this.changeDetectorRef.detectChanges();
    this.matchesLoaded = true;
    this.getStats();
  }

  changeFilterPanelChipSelected(chip: number) {
    this.filterPanelChipSelected = chip;
    this.filterMatches();
  }

  changeFilterLeagueSelected(league: number) {
    if (this.filterLeagueSelected.includes(league)) {
      this.filterLeagueSelected = this.filterLeagueSelected.filter(item => item !== league);
    } else {
      this.filterLeagueSelected.push(league);
    }
    this.filterMatches();
  }

  changeFilterSeasonSelected(season: SeasonInfo) {
    this.filterSeasonSelected = season;
    this.filterMatches();
  }

}
