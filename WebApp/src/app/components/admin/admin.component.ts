import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLeaguesComponent } from './leagues/admin-leagues.component';
import { AdminMatchesComponent } from './matches/admin-matches.component';
import { AdminPlayersComponent } from './players/admin-players.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminLeaguesComponent, AdminMatchesComponent, AdminPlayersComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent {
  selectedAdminView: 'leagues' | 'matches' | 'players' = 'leagues';
}