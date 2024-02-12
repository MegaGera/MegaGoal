/*
  Image service for retrieve the images routes from the assets folder
*/
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ImagesService {

  constructor() { }
    
  /*
    Get the route for a league image
  */
  getRouteImageLeague(id: number | string): string {
    return "/assets/img/leagues/" + id + ".png"; 
  }

  /*
    Get the route for a team image
  */
  getRouteImageTeam(id: number | string): string {
    return "/assets/img/teams/team_" + id + ".png"; 
  }

}
