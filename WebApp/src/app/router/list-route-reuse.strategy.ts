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
 * Home, Teams, Matches, Players, and the match page stay mounted after the user leaves.
 * Browser back and forward put that same instance back on screen.
 * Opening one of them from a link or the menu drops the saved instance and loads again.
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
    return future.routeConfig === curr.routeConfig;
  }

  private cacheKey(route: ActivatedRouteSnapshot): string | null {
    if (route.routeConfig?.data?.['reuseList'] !== true) {
      return null;
    }
    const path = route.routeConfig.path;
    return path ? path : null;
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
