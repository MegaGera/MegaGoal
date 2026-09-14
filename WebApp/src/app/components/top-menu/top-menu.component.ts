import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import {
  jamUser,
  jamMessage,
  jamSettingsAlt,
  jamLogOut,
  jamSearch,
  jamClose,
} from '@ng-icons/jam-icons';
import { ionLocation } from '@ng-icons/ionicons';
import { AuthService } from '../../services/auth.service';
import { MegaGoalService } from '../../services/megagoal.service';
import { GlobalSearchService } from '../../services/global-search.service';
import { ImagesService } from '../../services/images.service';
import { GlobalSearchResultItem } from '../../models/globalSearch';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-top-menu',
  standalone: true,
  imports: [NgIconComponent, RouterModule, FormsModule, SlicePipe],
  templateUrl: './top-menu.component.html',
  styleUrl: './top-menu.component.css',
  providers: [provideNgIconsConfig({
    size: '2.5em',
  }), provideIcons({
    jamUser,
    jamMessage,
    jamSettingsAlt,
    jamLogOut,
    jamSearch,
    jamClose,
    ionLocation,
  })]
})
export class TopMenuComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('navLinksTrack') navLinksTrack?: ElementRef<HTMLElement>;
  @ViewChild('globalSearchInput') globalSearchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('globalSearchRoot') globalSearchRoot?: ElementRef<HTMLElement>;

  isUserMenuOpen = false;
  isAdmin = false;
  username: string | null = null;
  navFadeLeft = false;
  navFadeRight = false;

  isSearchOpen = false;
  searchQuery = '';
  searchResults: GlobalSearchResultItem[] = [];
  searchLoading = false;
  searchActiveIndex = -1;
  private failedResultImages = new Set<string>();

  private routerSubscription?: Subscription;
  private userSubscription?: Subscription;
  private searchSubscription?: Subscription;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchRequestId = 0;
  private blurCloseTimer: ReturnType<typeof setTimeout> | null = null;
  /** Ignores the document click that follows opening (toggle node is destroyed). */
  private suppressSearchOutsideClose = false;

  constructor(
    private authService: AuthService,
    private megaGoalService: MegaGoalService,
    private globalSearch: GlobalSearchService,
    public images: ImagesService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.authService.isAdmin().subscribe(isAdmin => {
      this.isAdmin = isAdmin;
    });

    this.userSubscription = this.megaGoalService.userMe$.subscribe(user => {
      this.username = user?.username ?? null;
    });
    this.megaGoalService.getUserMe().subscribe({ error: () => {} });
    this.globalSearch.prefetchTopWatched();

    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.closeSearch();
        requestAnimationFrame(() => this.updateNavScrollFades());
      });
  }

  ngAfterViewInit(): void {
    this.updateNavScrollFades();
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    this.userSubscription?.unsubscribe();
    this.searchSubscription?.unsubscribe();
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (this.blurCloseTimer) clearTimeout(this.blurCloseTimer);
  }

  onNavLinksScroll(): void {
    this.updateNavScrollFades();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateNavScrollFades();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isSearchOpen) {
      this.closeSearch();
    }
  }

  private updateNavScrollFades(): void {
    if (this.isSearchOpen) {
      this.navFadeLeft = false;
      this.navFadeRight = false;
      return;
    }

    const el = this.navLinksTrack?.nativeElement;
    if (!el) {
      this.navFadeLeft = false;
      this.navFadeRight = false;
      return;
    }

    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 1) {
      this.navFadeLeft = false;
      this.navFadeRight = false;
      return;
    }

    const left = el.scrollLeft;
    this.navFadeLeft = left > 2;
    this.navFadeRight = left < maxScroll - 2;
  }

  openSearch(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.blurCloseTimer) {
      clearTimeout(this.blurCloseTimer);
      this.blurCloseTimer = null;
    }
    this.suppressSearchOutsideClose = true;
    this.isUserMenuOpen = false;
    this.isSearchOpen = true;
    this.searchActiveIndex = -1;

    const cached = this.globalSearch.getTopWatchedSnapshot();
    if (cached) {
      this.searchResults = cached;
      this.searchLoading = false;
    } else {
      this.searchResults = [];
      this.searchLoading = true;
    }
    this.runSearch(this.searchQuery);

    requestAnimationFrame(() => {
      this.globalSearchInput?.nativeElement?.focus();
      this.updateNavScrollFades();
      // Allow outside-click close on the next user gesture.
      setTimeout(() => {
        this.suppressSearchOutsideClose = false;
      }, 0);
    });
  }

  closeSearch(): void {
    if (this.blurCloseTimer) {
      clearTimeout(this.blurCloseTimer);
      this.blurCloseTimer = null;
    }
    this.isSearchOpen = false;
    this.searchQuery = '';
    this.searchResults = [];
    this.searchLoading = false;
    this.searchActiveIndex = -1;
    this.searchRequestId++;
    this.searchSubscription?.unsubscribe();
    this.searchSubscription = undefined;
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    requestAnimationFrame(() => this.updateNavScrollFades());
  }

  onSearchFocus(): void {
    if (this.blurCloseTimer) {
      clearTimeout(this.blurCloseTimer);
      this.blurCloseTimer = null;
    }
  }

  onSearchBlur(): void {
    // Delay so result mousedown can navigate before the panel collapses.
    this.blurCloseTimer = setTimeout(() => {
      this.blurCloseTimer = null;
      this.closeSearch();
    }, 160);
  }

  onSearchQueryChange(value: string): void {
    this.searchQuery = value;
    this.searchActiveIndex = -1;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.runSearch(this.searchQuery);
    }, 200);
  }

  clearSearchQuery(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.searchQuery = '';
    this.searchActiveIndex = -1;
    this.runSearch('');
    this.globalSearchInput?.nativeElement?.focus();
  }

  private runSearch(query: string): void {
    const requestId = ++this.searchRequestId;
    const trimmed = query.trim();
    if (!trimmed) {
      const cached = this.globalSearch.getTopWatchedSnapshot();
      if (cached) {
        this.searchResults = cached;
        this.searchLoading = false;
        return;
      }
    }
    this.searchLoading = true;
    this.searchSubscription?.unsubscribe();
    this.searchSubscription = this.globalSearch.search(query).subscribe({
      next: (results) => {
        if (requestId !== this.searchRequestId) return;
        this.searchResults = results;
        this.failedResultImages.clear();
        this.searchLoading = false;
      },
      error: () => {
        if (requestId !== this.searchRequestId) return;
        this.searchResults = [];
        this.searchLoading = false;
      },
    });
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (!this.isSearchOpen) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.searchResults.length) return;
      this.searchActiveIndex =
        (this.searchActiveIndex + 1) % this.searchResults.length;
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.searchResults.length) return;
      this.searchActiveIndex =
        this.searchActiveIndex <= 0
          ? this.searchResults.length - 1
          : this.searchActiveIndex - 1;
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item =
        this.searchActiveIndex >= 0
          ? this.searchResults[this.searchActiveIndex]
          : this.searchResults[0];
      if (item) this.selectResult(item);
    }
  }

  selectResult(item: GlobalSearchResultItem, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.blurCloseTimer) {
      clearTimeout(this.blurCloseTimer);
      this.blurCloseTimer = null;
    }

    if (item.type === 'team') {
      void this.router.navigate(['/app/team'], { queryParams: { id: item.id } });
    } else if (item.type === 'player') {
      void this.router.navigate(['/app/player'], { queryParams: { id: item.id } });
    } else {
      void this.router.navigate(['/app/leagues', item.id]);
    }
    this.closeSearch();
  }

  resultImageUrl(item: GlobalSearchResultItem): string {
    if (item.type === 'team') return this.images.getRouteImageTeam(item.id);
    if (item.type === 'player') return this.images.getRouteImagePlayer(item.id);
    return this.images.getRouteImageLeagueSm(item.id);
  }

  hasResultImage(item: GlobalSearchResultItem): boolean {
    return !this.failedResultImages.has(this.trackResult(item));
  }

  onResultImageError(item: GlobalSearchResultItem): void {
    this.failedResultImages.add(this.trackResult(item));
  }

  typeLabel(item: GlobalSearchResultItem): string {
    if (item.type === 'team') return 'Team';
    if (item.type === 'player') return 'Player';
    return 'Competition';
  }

  trackResult(item: GlobalSearchResultItem): string {
    return `${item.type}:${item.id}`;
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-dropdown')) {
      this.isUserMenuOpen = false;
    }
    if (this.suppressSearchOutsideClose) {
      return;
    }
    if (
      this.isSearchOpen &&
      this.globalSearchRoot &&
      !this.globalSearchRoot.nativeElement.contains(target)
    ) {
      this.closeSearch();
    }
  }

  logout(): void {
    fetch('https://megaauth.megagera.com/logout', {
      method: 'POST',
      credentials: 'include'
    })
    .then(response => {
      if (response.redirected) {
        window.location.href = response.url;
      } else if (response.ok) {
        window.location.href = '/';
      } else {
        alert('Logout failed. Please try again.');
      }
    })
    .catch(() => {
      alert('Error during logout.');
    });
  }
}
