import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminLeaguesComponent } from './leagues/admin-leagues.component';
import { AdminMatchesComponent } from './matches/admin-matches.component';
import { AdminPlayersComponent } from './players/admin-players.component';
import { AdminFeedbackComponent } from './feedback/admin-feedback.component';
import { AdminUsersComponent } from './users/admin-users.component';
import { AdminVenuesComponent } from './venues/admin-venues.component';

const ADMIN_VIEWS = ['leagues', 'matches', 'players', 'feedback', 'users', 'venues'] as const;
type AdminView = (typeof ADMIN_VIEWS)[number];

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminLeaguesComponent, AdminMatchesComponent, AdminPlayersComponent, AdminFeedbackComponent, AdminUsersComponent, AdminVenuesComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent implements OnInit {
  selectedAdminView: AdminView = 'leagues';

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.selectedAdminView = this.parseView(this.route.snapshot.queryParamMap.get('view'));
  }

  ngOnInit(): void {
    const raw = this.route.snapshot.queryParamMap.get('view');
    if (raw && this.parseView(raw) === 'leagues') {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { view: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  onAdminViewChange(view: string): void {
    const next = this.parseView(view);
    if (next === this.selectedAdminView) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        view: next === 'leagues' ? null : next,
        country: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  private parseView(value: string | null): AdminView {
    if (value && (ADMIN_VIEWS as readonly string[]).includes(value)) {
      return value as AdminView;
    }
    return 'leagues';
  }
}