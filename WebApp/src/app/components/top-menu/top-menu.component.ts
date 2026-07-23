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
import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamUserCircle, jamEyeF, jamUser, jamMessage, jamSettingsAlt, jamLogOut } from '@ng-icons/jam-icons';
import { ionLocation } from '@ng-icons/ionicons';
import { AuthService } from '../../services/auth.service';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-top-menu',
  standalone: true,
  imports: [NgIconComponent, RouterModule],
  templateUrl: './top-menu.component.html',
  styleUrl: './top-menu.component.css',
  providers: [provideNgIconsConfig({
    size: '2.5em',
  }), provideIcons({ jamUserCircle, jamEyeF, jamUser, jamMessage, jamSettingsAlt, jamLogOut, ionLocation })]
})
export class TopMenuComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('navLinksTrack') navLinksTrack?: ElementRef<HTMLElement>;

  isUserMenuOpen = false;
  isAdmin = false;
  navFadeLeft = false;
  navFadeRight = false;

  private routerSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.authService.isAdmin().subscribe(isAdmin => {
      this.isAdmin = isAdmin;
    });

    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        // Re-check after active link styles settle
        requestAnimationFrame(() => this.updateNavScrollFades());
      });
  }

  ngAfterViewInit(): void {
    this.updateNavScrollFades();
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  onNavLinksScroll(): void {
    this.updateNavScrollFades();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateNavScrollFades();
  }

  private updateNavScrollFades(): void {
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

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-dropdown')) {
      this.isUserMenuOpen = false;
    }
  }

  logout(): void {
    // Make a POST request to the logout endpoint
    fetch('https://megaauth.megagera.com/logout', {
      method: 'POST',
      credentials: 'include' // include cookies if needed
    })
    .then(response => {
      if (response.redirected) {
        window.location.href = response.url;
      } else if (response.ok) {
        // Redirect to landing page or login page after successful logout
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
