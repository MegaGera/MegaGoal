import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { TopMenuComponent } from './components/top-menu/top-menu.component';
import { FooterComponent } from './components/footer/footer.component';
import { MegaGoalService } from './services/megagoal.service';
import { StatsService } from './services/stats.service';
import { UpdaterService } from './services/updater.service';
import { HttpClientModule } from '@angular/common/http';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgbModule, CommonModule, RouterModule, TopMenuComponent, FooterComponent, HttpClientModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  providers: [MegaGoalService, StatsService, UpdaterService]
})
export class AppComponent {
  title = 'MegaGoal';
  currentRoute = '';

  constructor(private router: Router) {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentRoute = event.url;
      });
  }

  isLandingPage(): boolean {
    return this.currentRoute === '/' || this.currentRoute === '';
  }
}
