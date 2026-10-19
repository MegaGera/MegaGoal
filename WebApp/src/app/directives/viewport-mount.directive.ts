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
  private eagerCheckTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly el: ElementRef<HTMLElement>,
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    this.savedHeight = Math.max(80, this.viewportMountEstimate);

    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) {
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

    // Near-viewport check on the next macrotask (avoids first-paint flash + CD errors)
    this.eagerCheckTimer = setTimeout(() => {
      this.eagerCheckTimer = null;
      if (!this.observer) {
        return;
      }
      this.zone.run(() => this.applyIntersection(this.isNearViewport()));
    }, 0);
  }

  ngOnDestroy(): void {
    if (this.eagerCheckTimer != null) {
      clearTimeout(this.eagerCheckTimer);
      this.eagerCheckTimer = null;
    }
    this.observer?.disconnect();
    this.observer = undefined;
  }

  private applyIntersection(isIntersecting: boolean): void {
    if (isIntersecting) {
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
    const marginPx = this.parseVerticalMargin(this.viewportMountRootMargin);
    const rect = this.el.nativeElement.getBoundingClientRect();
    return rect.top < window.innerHeight + marginPx && rect.bottom > -marginPx;
  }

  private parseVerticalMargin(rootMargin: string): number {
    const first = rootMargin.trim().split(/\s+/)[0] ?? '0';
    const value = Number.parseFloat(first);
    return Number.isFinite(value) ? value : 0;
  }
}
