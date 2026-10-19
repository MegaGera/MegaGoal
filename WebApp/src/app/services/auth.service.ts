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

  private readonly credentialOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
    withCredentials: true,
  };

  /** Current MegaAuth session payload (username, email, permissions, …). */
  getAuthUser(): Observable<{
    id: string;
    username: string;
    email?: string;
    permissions: unknown[];
    test?: boolean;
  }> {
    return this.http
      .get<{ message: string; data: {
        id: string;
        username: string;
        email?: string;
        permissions: unknown[];
        test?: boolean;
      } }>(this.url + '/validate', this.credentialOptions)
      .pipe(map((res) => res.data));
  }

  changePassword(oldPassword: string, newPassword: string): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(
      this.url + '/change-password',
      { oldPassword, newPassword },
      this.credentialOptions
    );
  }

  changeEmail(email: string): Observable<{ id: string; email: string }> {
    return this.http.post<{ id: string; email: string }>(
      this.url + '/change-email',
      { email },
      this.credentialOptions
    );
  }
}
