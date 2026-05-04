import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { jamArrowRight, jamClose } from '@ng-icons/jam-icons';

import { MegaGoalService } from '../../services/megagoal.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule, RouterLink, NgIconComponent],
  templateUrl: './notification.component.html',
  styleUrl: './notification.component.css',
  providers: [provideIcons({ jamClose, jamArrowRight })]
})
export class NotificationComponent {
  @Input() message = '';

  /**
   * When set, the arrow becomes a router link (primary notification action).
   * Omit or pass null for a non-interactive decorative arrow.
   */
  @Input() actionRouterLink: string | any[] | null = null;

  /** Accessible label for the action link (defaults when unset). */
  @Input() actionAriaLabel = '';

  /**
   * Home notification `name` in the user document; when set, dismiss and action
   * call the API to mark the row as dismissed or clicked.
   */
  @Input() notificationName: string | null = null;

  get showActionLink(): boolean {
    const link = this.actionRouterLink;
    if (link == null) {
      return false;
    }
    if (typeof link === 'string') {
      return link.length > 0;
    }
    return Array.isArray(link) && link.length > 0;
  }

  get resolvedActionAriaLabel(): string {
    return this.actionAriaLabel?.trim() ? this.actionAriaLabel.trim() : 'Continue';
  }

  get syncsWithServer(): boolean {
    return !!this.notificationName?.trim();
  }

  constructor(
    private megagoal: MegaGoalService,
    private router: Router
  ) {}

  onDismiss(): void {
    if (!this.syncsWithServer) {
      return;
    }
    this.megagoal.markHomeNotification(this.notificationName!.trim(), 'dismissed').subscribe({
      error: (err) => console.error('Failed to dismiss notification:', err)
    });
  }

  onActionClick(event: Event): void {
    if (!this.showActionLink || !this.syncsWithServer) {
      return;
    }
    event.preventDefault();
    const link = this.actionRouterLink!;
    this.megagoal
      .markHomeNotification(this.notificationName!.trim(), 'clicked')
      .subscribe({
        next: () => this.navigateToAction(link),
        error: (err) => console.error('Failed to mark notification clicked:', err)
      });
  }

  private navigateToAction(link: string | any[]): void {
    if (typeof link === 'string') {
      void this.router.navigateByUrl(link);
    } else {
      void this.router.navigate(link);
    }
  }
}
