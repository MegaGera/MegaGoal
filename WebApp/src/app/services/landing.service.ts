import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Match } from '../models/match';
import { environment } from '../../environments/environment';

export interface LandingPageInfo {
  matches: Match[];
}

@Injectable({
  providedIn: 'root'
})
export class LandingService {
  private apiUrl = environment.serverURL;

  constructor(private http: HttpClient) { }

  getLandingPageInfo(): Observable<LandingPageInfo> {
    return this.http.get<LandingPageInfo>(`${this.apiUrl}/public/match/landing-info`);
  }
}
