import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  /*
    URL of the API server
  */
  url = environment.serverAuthURL;
  options = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: environment.production ? true : false
  }

  private adminStatus$ = new BehaviorSubject<boolean | null>(null);

  constructor(private http: HttpClient) {}

  isAdmin(): Observable<boolean> {
    if (!environment.production) {
      this.adminStatus$.next(true);
      return of(true);
    }
    if (this.adminStatus$.value !== null) {
      return of(this.adminStatus$.value);
    }
    return this.http.get(this.url + '/validate/admin', this.options).pipe(
      map(() => {
        this.adminStatus$.next(true);
        return true;
      }),
      catchError(() => {
        this.adminStatus$.next(false);
        return of(false);
      })
    );
  }

  get adminStatusObservable() {
    return this.adminStatus$.asObservable();
  }
}
