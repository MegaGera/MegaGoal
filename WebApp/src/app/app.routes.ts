import { Routes } from '@angular/router';
import { MatchCardComponent } from './components/match-card/match-card.component';
import { LeaguesComponent } from './components/leagues/leagues.component';
import { TeamComponent } from './components/team/team.component';

export const routes: Routes = [
    { path: 'matches', component: MatchCardComponent },
    { path: 'leagues', component: LeaguesComponent },
    { path: 'team', component: TeamComponent },
    { path: '**', redirectTo: '/matches' }
];
