import { Component } from '@angular/core';
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
    size: '3em',
  }), provideIcons({ jamUserCircle, jamEyeF })]
})
export class TopMenuComponent {

}
