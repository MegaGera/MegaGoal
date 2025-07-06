import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TopMenuComponent } from './components/top-menu/top-menu.component';
import { MegaGoalService } from './services/megagoal.service';
import { StatsService } from './services/stats.service';
import { UpdaterService } from './services/updater.service';
import { HttpClientModule } from '@angular/common/http';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgbModule, CommonModule, RouterModule, TopMenuComponent, HttpClientModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  providers: [MegaGoalService, StatsService, UpdaterService]
})
export class AppComponent {
  title = 'MegaGoal';

  constructor() { }

}
