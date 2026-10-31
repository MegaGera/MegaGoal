import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { ViewportMountDirective } from './viewport-mount.directive';

@Component({
  standalone: true,
  imports: [ViewportMountDirective],
  template: `
    <div appViewportMount #body="viewportMount">
      @if (body.isActive) {
        <span class="mounted">matches</span>
      } @else {
        <span class="placeholder">placeholder</span>
      }
    </div>
  `,
})
class HostComponent {}

describe('ViewportMountDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let observerCallback: IntersectionObserverCallback | null;
  let originalObserver: typeof IntersectionObserver;

  beforeEach(async () => {
    observerCallback = null;
    originalObserver = window.IntersectionObserver;

    class FakeObserver implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = '480px 0px';
      readonly thresholds = [0];

      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }

      observe(): void {
        observerCallback?.([
          { isIntersecting: false } as IntersectionObserverEntry,
        ], this);
      }

      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }

    window.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver;

    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
  });

  afterEach(() => {
    window.IntersectionObserver = originalObserver;
  });

  function host(): HTMLElement {
    return fixture.nativeElement.querySelector('[appViewportMount]') as HTMLElement;
  }

  function stubRect(top: number, height: number): void {
    spyOn(host(), 'getBoundingClientRect').and.returnValue({
      top,
      bottom: top + height,
      left: 0,
      right: 400,
      width: 400,
      height,
      x: 0,
      y: top,
      toJSON: () => ({}),
    } as DOMRect);
  }

  function notify(isIntersecting: boolean): void {
    observerCallback?.([
      { isIntersecting } as IntersectionObserverEntry,
    ], {} as IntersectionObserver);
    fixture.detectChanges();
  }

  it('mounts a host already in view when the first observer callback says it is hidden', fakeAsync(() => {
    fixture.detectChanges();
    stubRect(40, 280);

    tick(32);
    fixture.detectChanges();

    expect(host().querySelector('.mounted')).not.toBeNull();
  }));

  it('keeps an in-view host mounted when a later callback still says hidden', fakeAsync(() => {
    fixture.detectChanges();
    stubRect(40, 280);
    tick(32);
    fixture.detectChanges();

    notify(false);

    expect(host().querySelector('.mounted')).not.toBeNull();
  }));

  it('leaves an off-screen host unmounted and mounts it when it enters', fakeAsync(() => {
    fixture.detectChanges();
    stubRect(4000, 280);
    tick(32);
    fixture.detectChanges();

    expect(host().querySelector('.placeholder')).not.toBeNull();

    notify(true);

    expect(host().querySelector('.mounted')).not.toBeNull();
  }));
});
