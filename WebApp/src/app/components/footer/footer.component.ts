import { Component } from '@angular/core';
import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamGithub } from '@ng-icons/jam-icons';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [NgIconComponent],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
  providers: [
    provideNgIconsConfig({
      size: '2.5em',
    }), 
    provideIcons({ jamGithub })
  ]
})
export class FooterComponent {

}
