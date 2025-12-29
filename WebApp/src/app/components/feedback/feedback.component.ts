import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MegaGoalService } from '../../services/megagoal.service';
import { UserFeedback } from '../../models/user_feedback';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './feedback.component.html',
  styleUrl: './feedback.component.css'
})
export class FeedbackComponent implements OnInit {
  feedbackForm: FormGroup;
  featureOptions = [
    'Rate matches and teams and get recommended matches based on your votes and the ones of other users',
    'Map of where the users watch the matches and get insights (e.g. pub in Liverpool where users watch Real Madrid)',
    'Dedicated stats page',
    'Dark mode',
  ];
  votedFeatures: string[] = [];
  submitted = false;

  constructor(private fb: FormBuilder, private megaGoalService: MegaGoalService) {
    this.feedbackForm = this.fb.group({
      bug: [''],
      voted: [[]],
      proposal: [''],
      general: ['']
    });
  }

  ngOnInit(): void {
    // Log page visit
    this.megaGoalService.logPageVisit('feedback').subscribe({
      next: () => {},
      error: (error) => console.error('Error logging page visit:', error)
    });
  }

  onVoteChange(option: string, event: Event) {
    const target = event.target as HTMLInputElement;
    const checked = target.checked;
    const voted = this.feedbackForm.value.voted as string[];
    if (checked) {
      this.feedbackForm.patchValue({ voted: [...voted, option] });
    } else {
      this.feedbackForm.patchValue({ voted: voted.filter(o => o !== option) });
    }
  }

  submit() {
    this.submitted = true;
    if (this.feedbackForm.valid) {
      const feedbackData: UserFeedback = {
        bug: this.feedbackForm.value.bug,
        voted_features: this.feedbackForm.value.voted,
        proposal: this.feedbackForm.value.proposal,
        general: this.feedbackForm.value.general,
        created_at: new Date()
      };

      this.megaGoalService.submitFeedback(feedbackData).subscribe({
        next: (response) => {
          console.log('Feedback submitted successfully:', response);
          // Form is already marked as submitted, so thank you message will show
        },
        error: (error) => {
          console.error('Error submitting feedback:', error);
          this.submitted = false; // Reset to allow retry
        }
      });
    }
  }
} 