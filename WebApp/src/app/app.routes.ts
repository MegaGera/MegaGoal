import { Routes } from '@angular/router';
import { LeagueSelectorComponent } from './components/league-selector/league-selector.component';
import { LeagueDetailComponent } from './components/league-detail/league-detail.component';
import { TeamComponent } from './components/team/team.component';
import { HomeComponent } from './components/home/home.component';
import { LocationsComponent } from './components/locations/locations.component';
import { AdminComponent } from './components/admin/admin.component';

import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
    { path: 'home', component: HomeComponent },
    { path: 'leagues', component: LeagueSelectorComponent },
    { path: 'leagues/:id', component: LeagueDetailComponent },
    { path: 'team', component: TeamComponent },
    { path: 'locations', component: LocationsComponent },
    { path: 'admin', component: AdminComponent, canActivate: [adminGuard] },
    { path: '**', redirectTo: '/home' }
];
