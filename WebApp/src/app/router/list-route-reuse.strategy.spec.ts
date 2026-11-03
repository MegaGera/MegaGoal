import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';

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

  function snapshot(path: string, reuseList: boolean): ActivatedRouteSnapshot {
    return {
      routeConfig: {
        path,
        data: reuseList ? { reuseList: true } : {},
      },
    } as ActivatedRouteSnapshot;
  }

  it('detaches only the list routes', () => {
    expect(strategy.shouldDetach(snapshot('players', true))).toBeTrue();
    expect(strategy.shouldDetach(snapshot('player', false))).toBeFalse();
  });

  it('returns the same handle for back and forward until the router clears it', () => {
    const players = snapshot('players', true);
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

  it('drops the saved list when the menu opens it again', () => {
    const teams = snapshot('teams', true);
    const handle = { componentRef: { destroy: jasmine.createSpy('destroy') } };
    strategy.store(teams, handle);

    trigger = 'imperative';
    expect(strategy.shouldAttach(teams)).toBeFalse();
    expect(handle.componentRef.destroy).toHaveBeenCalled();
    expect(strategy.retrieve(teams)).toBeNull();
  });

  it('reuses a route when only the query string changes', () => {
    const config = { path: 'home', data: { reuseList: true } };
    const current = { routeConfig: config } as unknown as ActivatedRouteSnapshot;
    const next = { routeConfig: config } as unknown as ActivatedRouteSnapshot;
    expect(strategy.shouldReuseRoute(next, current)).toBeTrue();
    expect(strategy.shouldReuseRoute(snapshot('matches', true), snapshot('home', true))).toBeFalse();
  });
});
