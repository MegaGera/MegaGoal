import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { MegaGoalService } from './megagoal.service';
import {
  GLOBAL_SEARCH_LIMIT,
  GlobalSearchResultItem,
} from '../models/globalSearch';

@Injectable({
  providedIn: 'root',
})
export class GlobalSearchService {
  private topWatchedCache: GlobalSearchResultItem[] | null = null;
  private topWatchedLoad$: Observable<GlobalSearchResultItem[]> | null = null;

  constructor(private megagoal: MegaGoalService) {}

  /**
   * Warm the empty-query list (top watched) so opening search is instant.
   */
  prefetchTopWatched(): void {
    this.ensureTopWatched().subscribe({ error: () => {} });
  }

  /** Snapshot of prefetched empty-query results, if ready. */
  getTopWatchedSnapshot(): GlobalSearchResultItem[] | null {
    return this.topWatchedCache;
  }

  /**
   * Global typeahead via Server GET /search (single call).
   * Empty query → cached top watched when available.
   */
  search(query: string): Observable<GlobalSearchResultItem[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return this.ensureTopWatched();
    }
    return this.megagoal.searchGlobal(trimmed, { limit: GLOBAL_SEARCH_LIMIT }).pipe(
      map((res) => res.items ?? []),
      catchError(() => of([])),
    );
  }

  private ensureTopWatched(): Observable<GlobalSearchResultItem[]> {
    if (this.topWatchedCache) {
      return of(this.topWatchedCache);
    }
    if (!this.topWatchedLoad$) {
      this.topWatchedLoad$ = this.megagoal
        .searchGlobal('', { limit: GLOBAL_SEARCH_LIMIT })
        .pipe(
          map((res) => res.items ?? []),
          tap((results) => {
            this.topWatchedCache = results;
          }),
          catchError(() => of([])),
          shareReplay(1),
        );
    }
    return this.topWatchedLoad$;
  }
}
