import { Component, HostListener, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamUserCircle, jamEyeF, jamGithub } from '@ng-icons/jam-icons';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-top-menu',
  standalone: true,
  imports: [NgIconComponent, RouterModule],
  templateUrl: './top-menu.component.html',
  styleUrl: './top-menu.component.css',
  providers: [provideNgIconsConfig({
    size: '2.5em',
  }), provideIcons({ jamUserCircle, jamEyeF, jamGithub })]
})
export class TopMenuComponent implements OnInit {
  isUserMenuOpen = false;
  isAdmin = false;

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.authService.isAdmin().subscribe(isAdmin => {
      this.isAdmin = isAdmin;
    });
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
}
