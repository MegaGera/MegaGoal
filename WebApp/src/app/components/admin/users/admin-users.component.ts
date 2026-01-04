import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MegaGoalService } from '../../../services/megagoal.service';

interface UserMatchCount {
  username: string;
  matchCount: number;
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.css'
})
export class AdminUsersComponent implements OnInit {
  usersList: UserMatchCount[] = [];
  loading = false;
  error: string | null = null;

  constructor(private megaGoalService: MegaGoalService) {}

  ngOnInit(): void {
    this.loadUsersMatchCounts();
  }

  loadUsersMatchCounts(): void {
    this.loading = true;
    this.error = null;
    this.megaGoalService.getUsersMatchCounts().subscribe({
      next: (users: UserMatchCount[]) => {
        this.usersList = users || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading users match counts:', err);
        this.error = 'Failed to load users match counts. Please try again.';
        this.loading = false;
      }
    });
  }

  get totalUsers(): number {
    return this.usersList.length;
  }

  get totalMatches(): number {
    return this.usersList.reduce((sum, user) => sum + user.matchCount, 0);
  }

  get averageMatchesPerUser(): number {
    if (this.totalUsers === 0) return 0;
    return Math.round((this.totalMatches / this.totalUsers) * 10) / 10;
  }
}

