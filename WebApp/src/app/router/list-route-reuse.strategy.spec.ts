import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Route, Router } from '@angular/router';

import { ListRouteReuseStrategy } from './list-route-reuse.strategy';

describe('ListRouteReuseStrategy', () => {
  let strategy: ListRouteReuseStrategy;
  let trigger: 'imperative' | 'popstate' = 'popstate';

  beforeEach(() => {
    trigger = 'popstate';
    TestBed.configureTestingModule({
      providers: [
        ListRouteReuseStrategy,
        {
          provide: Router,
          useValue: {
            getCurrentNavigation: () => ({ trigger }),
          },
        },
      ],
    });
    strategy = TestBed.inject(ListRouteReuseStrategy);
  });

  function snapshot(
    path: string,
    extras: {
      params?: Record<string, string>;
      queryParams?: Record<string, string>;
      config?: Route;
      component?: boolean;
    } = {},
  ): ActivatedRouteSnapshot {
    const routeConfig = extras.config ?? {
      path,
      ...(extras.component === false ? {} : { component: class {} }),
    };
    return {
      routeConfig,
      params: extras.params ?? {},
      queryParams: extras.queryParams ?? {},
    } as ActivatedRouteSnapshot;
  }

  it('detaches every screen and skips redirects', () => {
    expect(strategy.shouldDetach(snapshot('players'))).toBeTrue();
    expect(strategy.shouldDetach(snapshot('profile'))).toBeTrue();
    expect(strategy.shouldDetach(snapshot(''))).toBeTrue();
    expect(strategy.shouldDetach(snapshot('admin', { component: false }))).toBeFalse();
  });

  it('returns the same handle for back and forward until the router clears it', () => {
    const players = snapshot('players');
    const handle = { componentRef: { destroy: jasmine.createSpy('destroy') } };
    strategy.store(players, handle);

    expect(strategy.shouldAttach(players)).toBeTrue();
    expect(strategy.retrieve(players)).toBe(handle);
    expect(strategy.retrieve(players)).toBe(handle);
    expect(handle.componentRef.destroy).not.toHaveBeenCalled();

    strategy.store(players, null);
    expect(strategy.shouldAttach(players)).toBeFalse();
    expect(strategy.retrieve(players)).toBeNull();
  });

  it('drops only the screen the menu opens again', () => {
    const playerConfig: Route = { path: 'player', component: class {} };
    const first = snapshot('player', { queryParams: { id: '1' }, config: playerConfig });
    const second = snapshot('player', { queryParams: { id: '2' }, config: playerConfig });
    const firstHandle = { componentRef: { destroy: jasmine.createSpy('destroyFirst') } };
    const secondHandle = { componentRef: { destroy: jasmine.createSpy('destroySecond') } };
    strategy.store(first, firstHandle);
    strategy.store(second, secondHandle);

    trigger = 'imperative';
    expect(strategy.shouldAttach(first)).toBeFalse();
    expect(firstHandle.componentRef.destroy).toHaveBeenCalled();
    expect(strategy.retrieve(first)).toBeNull();
    expect(strategy.retrieve(second)).toBe(secondHandle);
    expect(secondHandle.componentRef.destroy).not.toHaveBeenCalled();
  });

  it('keeps a separate instance per team, player, match, league season, and matches date', () => {
    const playerConfig: Route = { path: 'player', component: class {} };
    const samePlayer = snapshot('player', { queryParams: { id: '9' }, config: playerConfig });
    const otherPlayer = snapshot('player', { queryParams: { id: '4' }, config: playerConfig });
    expect(strategy.shouldReuseRoute(samePlayer, snapshot('player', { queryParams: { id: '9' }, config: playerConfig }))).toBeTrue();
    expect(strategy.shouldReuseRoute(otherPlayer, samePlayer)).toBeFalse();

    const leagueConfig: Route = { path: 'leagues/:id', component: class {} };
    const bare = snapshot('leagues/:id', { params: { id: '39' }, config: leagueConfig });
    const season = snapshot('leagues/:id', {
      params: { id: '39' },
      queryParams: { season: '2024', matchday: '3' },
      config: leagueConfig,
    });
    const otherMatchday = snapshot('leagues/:id', {
      params: { id: '39' },
      queryParams: { season: '2024', matchday: '4' },
      config: leagueConfig,
    });
    const otherSeason = snapshot('leagues/:id', {
      params: { id: '39' },
      queryParams: { season: '2023', matchday: '1' },
      config: leagueConfig,
    });
    expect(strategy.shouldReuseRoute(season, bare)).toBeTrue();
    expect(strategy.shouldReuseRoute(otherMatchday, season)).toBeTrue();
    expect(strategy.shouldReuseRoute(otherSeason, season)).toBeFalse();

    const matchesConfig: Route = { path: 'matches', component: class {} };
    const day = snapshot('matches', { queryParams: { date: '2026-01-01' }, config: matchesConfig });
    const nextDay = snapshot('matches', { queryParams: { date: '2026-01-02' }, config: matchesConfig });
    const live = snapshot('matches', { queryParams: { date: '2026-01-01', live: 'true' }, config: matchesConfig });
    expect(strategy.shouldReuseRoute(nextDay, day)).toBeFalse();
    expect(strategy.shouldReuseRoute(live, day)).toBeTrue();

    const homeConfig: Route = { path: 'home', component: class {} };
    const filtered = snapshot('home', { queryParams: { chip: '1' }, config: homeConfig });
    const otherFilter = snapshot('home', { queryParams: { chip: '2' }, config: homeConfig });
    expect(strategy.shouldReuseRoute(otherFilter, filtered)).toBeTrue();
    expect(strategy.shouldReuseRoute(snapshot('teams'), snapshot('home'))).toBeFalse();
  });
});
