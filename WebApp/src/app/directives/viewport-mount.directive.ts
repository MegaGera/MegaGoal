import {
  AfterViewInit,
  ChangeDetectorRef,
  Directive,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
} from '@angular/core';

/**
 * Observes the host and exposes `isActive` so heavy children can be
 * mounted only near the viewport. Keeps scroll height via `savedHeight`.
 *
 * The first IntersectionObserver notification can report a just-inserted
 * host as hidden. That state does not update again until the host leaves
 * and re-enters, so a league already on screen stays empty. The initial
 * decision is taken from layout, after the next frame, and a later
 * "hidden" notification is ignored while the host is still near the viewport.
 */
@Directive({
  selector: '[appViewportMount]',
  standalone: true,
  exportAs: 'viewportMount',
})
export class ViewportMountDirective implements AfterViewInit, OnDestroy {
  /** Fallback height (px) before the body has been measured. */
  @Input() viewportMountEstimate = 280;

  /** Extra root margin so content mounts slightly before it enters view. */
  @Input() viewportMountRootMargin = '480px 0px';

  isActive = false;
  savedHeight = 280;

  private observer?: IntersectionObserver;
  private frameIds: number[] = [];
  private layoutReady = false;
  private destroyed = false;

  constructor(
    private readonly el: ElementRef<HTMLElement>,
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    this.savedHeight = Math.max(80, this.viewportMountEstimate);
    this.scheduleInitialCheck();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.cancelInitialCheck();
    this.observer?.disconnect();
    this.observer = undefined;
  }

  private scheduleInitialCheck(): void {
    const first = requestAnimationFrame(() => {
      const second = requestAnimationFrame(() => {
        this.frameIds = [];
        if (this.destroyed) {
          return;
        }
        this.layoutReady = true;
        this.zone.run(() => this.applyIntersection(this.isNearViewport()));
        this.startObserver();
      });
      this.frameIds = [second];
    });
    this.frameIds = [first];
  }

  private cancelInitialCheck(): void {
    for (const id of this.frameIds) {
      cancelAnimationFrame(id);
    }
    this.frameIds = [];
  }

  private startObserver(): void {
    if (this.destroyed) {
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (!entry || this.destroyed) {
            return;
          }
          this.zone.run(() => this.applyIntersection(entry.isIntersecting));
        },
        {
          root: null,
          rootMargin: this.viewportMountRootMargin,
          threshold: 0,
        }
      );
      this.observer.observe(this.el.nativeElement);
    });
  }

  private applyIntersection(isIntersecting: boolean): void {
    if (this.destroyed) {
      return;
    }

    // A hidden report before layout is not trustworthy and would stick.
    if (!isIntersecting && !this.layoutReady) {
      return;
    }

    const visible = isIntersecting || this.isNearViewport();
    if (visible) {
      if (!this.isActive) {
        this.isActive = true;
        this.cdr.detectChanges();
      }
      return;
    }

    if (!this.isActive) {
      return;
    }

    const height = this.el.nativeElement.offsetHeight;
    if (height > 0) {
      this.savedHeight = height;
    }
    this.isActive = false;
    this.cdr.detectChanges();
  }

  private isNearViewport(): boolean {
    const rect = this.el.nativeElement.getBoundingClientRect();
    if (rect.top === 0 && rect.bottom === 0 && rect.width === 0 && rect.height === 0) {
      return false;
    }
    const marginPx = this.parseVerticalMargin(this.viewportMountRootMargin);
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    return rect.top < viewportHeight + marginPx && rect.bottom > -marginPx;
  }

  private parseVerticalMargin(rootMargin: string): number {
    const first = rootMargin.trim().split(/\s+/)[0] ?? '0';
    const value = Number.parseFloat(first);
    return Number.isFinite(value) ? value : 0;
  }
}
