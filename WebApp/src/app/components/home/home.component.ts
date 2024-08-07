import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { Match } from '../../models/match';
import { Location } from '../../models/location';
import { RealMatchCardComponent } from '../real-match-card/real-match-card.component';
import { PaginationComponent } from '../pagination/pagination.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RealMatchCardComponent, PaginationComponent, MatProgressSpinnerModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  providers: [ImagesService]
})
export class HomeComponent implements OnInit {

  /* 
    Array of matches
  */
  matches: Match[] = [];
  matchesLoaded: boolean = false;
  matchesPerPage: number = 20;
  matchesFiltered: Match[] = [];
  locations: Location[] = [];

  constructor(private megagoal: MegaGoalService, public images: ImagesService, private changeDetectorRef: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.getAllMatches();
    this.getLocations();
  }

  /* 
    Get all matches from the service
  */
  getAllMatches() {
    this.megagoal.getAllMatches().subscribe(result => {
      this.matches = <Match[]>result;
      this.matches.sort(function(x, y){
        return y.fixture.timestamp - x.fixture.timestamp;
      })
      this.changeDetectorRef.detectChanges();
      this.matchesLoaded = true;
    })
  }

  getLocations() {
    this.megagoal.getLocations().subscribe(result => {
      this.locations = <Location[]>result;
    })
  }

}
