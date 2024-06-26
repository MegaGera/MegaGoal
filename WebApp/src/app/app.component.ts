import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TopMenuComponent } from './components/top-menu/top-menu.component';
import { MegaGoalService } from './services/megagoal.service';
import { HttpClientModule } from '@angular/common/http';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgbModule, CommonModule, RouterModule, TopMenuComponent, HttpClientModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  providers: [MegaGoalService]
})
export class AppComponent {
  title = 'WebApp';

  constructor(public megagoal: MegaGoalService) { }

}
