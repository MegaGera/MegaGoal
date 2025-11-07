import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgOptimizedImage } from '@angular/common';
import { Team } from '../../../models/team';
import { ImagesService } from '../../../services/images.service';

@Component({
  selector: 'app-team-header',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage],
  templateUrl: './team-header.component.html',
  styleUrl: './team-header.component.css',
  providers: [ImagesService]
})
export class TeamHeaderComponent {
  @Input({ required: true }) team!: Team;

  constructor(public images: ImagesService) {}
}

