import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ImagesService } from '../../services/images.service';

@Component({
  selector: 'app-match-team-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './match-team-header.component.html',
  styleUrl: './match-team-header.component.css'
})
export class MatchTeamHeaderComponent {
  @Input() teamId!: number;
  @Input() teamName!: string;
  @Input() side: 'home' | 'away' = 'home';

  constructor(public images: ImagesService) {}
}
