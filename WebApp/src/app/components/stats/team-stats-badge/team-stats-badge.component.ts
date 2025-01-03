import { Component, Input} from '@angular/core';
import { NgClass } from '@angular/common';

import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamEyeF } from '@ng-icons/jam-icons';
import { ionFootball } from '@ng-icons/ionicons';

import { ImagesService } from '../../../services/images.service';

@Component({
  selector: 'app-team-stats-badge',
  standalone: true,
  imports: [NgIconComponent, NgClass],
  templateUrl: './team-stats-badge.component.html',
  styleUrl: './team-stats-badge.component.css',
  providers: [ImagesService, provideNgIconsConfig({
    size: '1.2rem',
  }), provideIcons({ jamEyeF, ionFootball })]
})
export class TeamStatsBadgeComponent {
  @Input() team!: any;
  @Input() class!: string;

  constructor(public images: ImagesService) { }
}
