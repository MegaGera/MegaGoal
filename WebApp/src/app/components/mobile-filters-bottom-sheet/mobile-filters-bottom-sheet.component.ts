import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamClose, jamSettingsAlt } from '@ng-icons/jam-icons';

const DISMISS_DISTANCE_PX = 100;
const DISMISS_VELOCITY = 0.45;
const CLOSE_ANIMATION_MS = 280;

@Component({
  selector: 'app-mobile-filters-bottom-sheet',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  templateUrl: './mobile-filters-bottom-sheet.component.html',
  styleUrls: ['./mobile-filters-bottom-sheet.component.css'],
  providers: [
    provideIcons({ jamClose, jamSettingsAlt }),
    provideNgIconsConfig({ size: '1em' }),
  ],
})
export class MobileFiltersBottomSheetComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() title = 'Filters';

  @Output() closed = new EventEmitter<void>();

  @ViewChild('chrome', { static: true }) chromeRef!: ElementRef<HTMLElement>;

  /** Live drag / exit offset (px). */
  dragOffset = 0;
  dragging = false;
  /** Plays slide-down + fade-out before emitting `closed`. */
  closing = false;

  private touchStartY = 0;
  private touchStartTime = 0;
  private bodyOverflowBackup: string | null = null;
  private removeTouchListeners: (() => void) | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly onTouchStartBound = (event: TouchEvent) => this.onTouchStart(event);
  private readonly onTouchMoveBound = (event: TouchEvent) => this.onTouchMove(event);
  private readonly onTouchEndBound = () => this.onTouchEnd();

  ngOnInit(): void {
    this.lockBodyScroll();
  }

  ngAfterViewInit(): void {
    const chrome = this.chromeRef.nativeElement;
    chrome.addEventListener('touchstart', this.onTouchStartBound, { passive: true });
    chrome.addEventListener('touchmove', this.onTouchMoveBound, { passive: false });
    chrome.addEventListener('touchend', this.onTouchEndBound);
    chrome.addEventListener('touchcancel', this.onTouchEndBound);
    this.removeTouchListeners = () => {
      chrome.removeEventListener('touchstart', this.onTouchStartBound);
      chrome.removeEventListener('touchmove', this.onTouchMoveBound);
      chrome.removeEventListener('touchend', this.onTouchEndBound);
      chrome.removeEventListener('touchcancel', this.onTouchEndBound);
    };
  }

  ngOnDestroy(): void {
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    this.removeTouchListeners?.();
    this.removeTouchListeners = null;
    this.unlockBodyScroll();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.requestClose();
  }

  onBackdropClick(): void {
    this.requestClose();
  }

  onCloseClick(): void {
    this.requestClose();
  }

  onSheetClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  private onTouchStart(event: TouchEvent): void {
    if (this.closing || !event.touches.length) {
      return;
    }
    this.dragging = true;
    this.touchStartY = event.touches[0].clientY;
    this.touchStartTime = Date.now();
    this.dragOffset = 0;
  }

  private onTouchMove(event: TouchEvent): void {
    if (this.closing || !this.dragging || !event.touches.length) {
      return;
    }
    const delta = event.touches[0].clientY - this.touchStartY;
    this.dragOffset = Math.max(0, delta);
    if (this.dragOffset > 0) {
      event.preventDefault();
    }
  }

  private onTouchEnd(): void {
    if (this.closing || !this.dragging) {
      return;
    }
    const elapsed = Math.max(Date.now() - this.touchStartTime, 1);
    const velocity = this.dragOffset / elapsed;
    const shouldDismiss =
      this.dragOffset >= DISMISS_DISTANCE_PX || velocity >= DISMISS_VELOCITY;

    this.dragging = false;

    if (shouldDismiss) {
      this.requestClose();
      return;
    }
    this.dragOffset = 0;
  }

  private requestClose(): void {
    if (this.closing) {
      return;
    }
    this.dragging = false;
    this.closing = true;

    const dismissY = Math.round(window.innerHeight * 0.75);
    // Paint current offset with transition enabled, then slide fully off-screen.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.dragOffset = Math.max(this.dragOffset, dismissY);
      });
    });

    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      this.closed.emit();
    }, CLOSE_ANIMATION_MS);
  }

  private lockBodyScroll(): void {
    if (this.bodyOverflowBackup !== null) {
      return;
    }
    this.bodyOverflowBackup = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll(): void {
    if (this.bodyOverflowBackup === null) {
      return;
    }
    document.body.style.overflow = this.bodyOverflowBackup;
    this.bodyOverflowBackup = null;
  }
}
