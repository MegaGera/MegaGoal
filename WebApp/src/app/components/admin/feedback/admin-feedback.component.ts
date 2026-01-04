import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MegaGoalService } from '../../../services/megagoal.service';
import { UserFeedback } from '../../../models/user_feedback';

@Component({
  selector: 'app-admin-feedback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-feedback.component.html',
  styleUrl: './admin-feedback.component.css'
})
export class AdminFeedbackComponent implements OnInit {
  feedbackList: UserFeedback[] = [];
  loading = false;
  error: string | null = null;
  expandedFeedbackIds: Set<string> = new Set();

  constructor(private megaGoalService: MegaGoalService) {}

  ngOnInit(): void {
    this.loadFeedback();
  }

  loadFeedback(): void {
    this.loading = true;
    this.error = null;
    this.megaGoalService.getAllFeedback().subscribe({
      next: (feedback: UserFeedback[]) => {
        this.feedbackList = feedback || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading feedback:', err);
        this.error = 'Failed to load feedback. Please try again.';
        this.loading = false;
      }
    });
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  hasContent(feedback: UserFeedback): boolean {
    return !!(
      feedback.bug ||
      (feedback.voted_features && feedback.voted_features.length > 0) ||
      feedback.proposal ||
      feedback.general
    );
  }

  get totalSubmissions(): number {
    return this.feedbackList.length;
  }

  get totalBugReports(): number {
    return this.feedbackList.filter(f => f.bug && f.bug.trim().length > 0).length;
  }

  get totalProposals(): number {
    return this.feedbackList.filter(f => f.proposal && f.proposal.trim().length > 0).length;
  }

  getUsername(feedback: UserFeedback): string {
    return feedback.username || 'Anonymous';
  }

  getFeedbackId(feedback: UserFeedback): string {
    return feedback._id || feedback.id || '';
  }

  isExpanded(feedback: UserFeedback): boolean {
    return this.expandedFeedbackIds.has(this.getFeedbackId(feedback));
  }

  toggleExpand(feedback: UserFeedback): void {
    const id = this.getFeedbackId(feedback);
    if (this.expandedFeedbackIds.has(id)) {
      this.expandedFeedbackIds.delete(id);
    } else {
      this.expandedFeedbackIds.add(id);
    }
  }

  getFeedbackPreview(feedback: UserFeedback): string {
    const parts: string[] = [];
    if (feedback.bug) parts.push('🐞 Bug Report');
    if (feedback.voted_features && feedback.voted_features.length > 0) {
      parts.push(`🗳️ ${feedback.voted_features.length} feature(s) voted`);
    }
    if (feedback.proposal) parts.push('💡 Feature Proposal');
    if (feedback.general) parts.push('📝 General Feedback');
    return parts.join(' • ') || 'No content';
  }
}

