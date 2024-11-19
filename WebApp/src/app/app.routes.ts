import { Routes } from '@angular/router';
import { LeaguesComponent } from './components/leagues/leagues.component';
import { TeamComponent } from './components/team/team.component';
import { HomeComponent } from './components/home/home.component';
import { LocationsComponent } from './components/locations/locations.component';
import { AdminComponent } from './components/admin/admin.component';

export const routes: Routes = [
    { path: 'home', component: HomeComponent },
    { path: 'leagues', component: LeaguesComponent },
    { path: 'team', component: TeamComponent },
    { path: 'locations', component: LocationsComponent },
    { path: 'admin', component: AdminComponent },
    { path: '**', redirectTo: '/home' }
];
