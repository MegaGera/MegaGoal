import { Injectable, Injector } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  DetachedRouteHandle,
  RouteReuseStrategy,
  Router,
} from '@angular/router';

interface DetachedListHandle extends DetachedRouteHandle {
  componentRef?: { destroy(): void };
}

/**
 * Every screen stays mounted after the user leaves.
 * Browser back and forward put that same instance back on screen, so it does not load again.
 * Opening a screen from a link or the menu drops the saved instance and loads again.
 *
 * A team, player, match, league season, and matches date each keep their own instance.
 * Filter query changes stay on the same instance.
 *
 * The router asks for the saved handle twice during one navigation
 * (while building the route tree, then while attaching the outlet) and
 * then stores null. Retrieve must not drop the handle.
 */
@Injectable()
export class ListRouteReuseStrategy implements RouteReuseStrategy {
  private readonly handles = new Map<string, DetachedListHandle>();

  constructor(private readonly injector: Injector) {}

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return this.cacheKey(route) != null;
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = this.cacheKey(route);
    if (key == null) {
      return;
    }
    if (handle == null) {
      this.handles.delete(key);
      return;
    }
    this.handles.set(key, handle);
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const key = this.cacheKey(route);
    if (key == null || !this.handles.has(key)) {
      return false;
    }
    if (this.navigationTrigger() === 'imperative') {
      this.discard(key);
      return false;
    }
    return true;
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const key = this.cacheKey(route);
    if (key == null) {
      return null;
    }
    return this.handles.get(key) ?? null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    if (future.routeConfig !== curr.routeConfig) {
      return false;
    }
    const futureKey = this.cacheKey(future);
    const currKey = this.cacheKey(curr);
    if (futureKey === currKey) {
      return true;
    }
    return this.sameLeagueWhileSeasonSettles(future, curr);
  }

  private cacheKey(route: ActivatedRouteSnapshot): string | null {
    const config = route.routeConfig;
    if (!config?.component) {
      return null;
    }
    const path = config.path ?? '';
    const query = route.queryParams ?? {};
    const params = route.params ?? {};

    if (path === 'leagues/:id') {
      const season = query['season'];
      return season ? `leagues/${params['id']}/season/${season}` : `leagues/${params['id']}`;
    }
    if (path === 'team') {
      return `team/${query['id'] ?? ''}`;
    }
    if (path === 'player') {
      return `player/${query['id'] ?? ''}`;
    }
    if (path === 'match') {
      return `match/${query['id'] ?? ''}`;
    }
    if (path === 'matches') {
      return `matches/${query['date'] || this.todayIso()}`;
    }
    return path === '' ? 'landing' : path;
  }

  /**
   * The league page writes season onto the current history entry after the first load.
   * That write must keep the instance that is already on screen.
   */
  private sameLeagueWhileSeasonSettles(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    if (future.routeConfig?.path !== 'leagues/:id') {
      return false;
    }
    if ((future.params ?? {})['id'] !== (curr.params ?? {})['id']) {
      return false;
    }
    const futureSeason = (future.queryParams ?? {})['season'];
    const currSeason = (curr.queryParams ?? {})['season'];
    return !futureSeason || !currSeason;
  }

  private todayIso(): string {
    return new Date().toISOString().split('T')[0];
  }

  private navigationTrigger(): string | undefined {
    return this.injector.get(Router).getCurrentNavigation()?.trigger;
  }

  private discard(key: string): void {
    const handle = this.handles.get(key);
    this.handles.delete(key);
    handle?.componentRef?.destroy();
  }
}
