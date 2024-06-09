import { Component } from '@angular/core';
import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { Match } from '../../models/match';
import { Location } from '../../models/location';
import { RealMatchCardComponent } from '../real-match-card/real-match-card.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RealMatchCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  providers: [ImagesService]
})
export class HomeComponent {

  /* 
    Array of matches
  */
  matches: Match[] = [];
  locations: Location[] = [];

  constructor(private megagoal: MegaGoalService, public images: ImagesService) {
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
    })
  }

  getLocations() {
    this.megagoal.getLocations().subscribe(result => {
      this.locations = <Location[]>result;
    })
  }

}
