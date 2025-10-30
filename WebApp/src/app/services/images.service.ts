/*
  Image service for retrieve the images routes from the assets folder
*/
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ImagesService {

  /*
    URL of the API server
  */
  url = environment.serverImagesURL;

  constructor() { }
    
  /*
    Get the route for a league image
  */
  getRouteImageLeague(id: number | string): string {
    return this.url + "/leagues/" + id + ".png"; 
  }

  /*
    Get the route for a league image back
  */
  getRouteImageLeagueBack(id: number | string): string {
    return this.url + "/leagues/back/" + id + ".png"; 
  }

  /*
    Get the route for a league image back
  */
  getRouteImageLeagueSm(id: number | string): string {
    return this.url + "/leagues/sm/" + id + ".png"; 

  }

  /*
    Get the route for a team image
  */
  getRouteImageTeam(id: number | string): string {
    return this.url + "/teams/team_" + id + ".png"; 
  }

  /*
    Get the route for a player image
  */
  getRouteImagePlayer(id: number | string): string {
    return `https://media.api-sports.io/football/players/${id}.png`;
  }

}
