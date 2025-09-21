import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Match } from '../models/match';

export interface LandingPageInfo {
  matches: Match[];
}

@Injectable({
  providedIn: 'root'
})
export class LandingService {
  private apiUrl = 'http://localhost:3150/public/match'; // Public endpoint

  constructor(private http: HttpClient) { }

  getLandingPageInfo(): Observable<LandingPageInfo> {
    return this.http.get<LandingPageInfo>(`${this.apiUrl}/landing-info`);
  }
}
