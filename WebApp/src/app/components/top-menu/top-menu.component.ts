import { Component, HostListener } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamUserCircle, jamEyeF } from '@ng-icons/jam-icons';

@Component({
  selector: 'app-top-menu',
  standalone: true,
  imports: [NgIconComponent, RouterModule],
  templateUrl: './top-menu.component.html',
  styleUrl: './top-menu.component.css',
  providers: [provideNgIconsConfig({
    size: '2.5em',
  }), provideIcons({ jamUserCircle, jamEyeF })]
})
export class TopMenuComponent {
  isUserMenuOpen = false;

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
