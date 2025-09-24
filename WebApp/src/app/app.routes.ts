import { Routes } from '@angular/router';
import { LeagueSelectorComponent } from './components/league-selector/league-selector.component';
import { LeagueDetailComponent } from './components/league-detail/league-detail.component';
import { TeamComponent } from './components/team/team.component';
import { HomeComponent } from './components/home/home.component';
import { LocationsComponent } from './components/locations/locations.component';
import { AdminComponent } from './components/admin/admin.component';
import { FeedbackComponent } from './components/feedback/feedback.component';
import { MatchesComponent } from './components/matches/matches.component';
import { StatsComponent } from './components/stats/stats.component';
import { LandingPageComponent } from './components/landing-page/landing-page.component';

import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
    { path: '', component: LandingPageComponent },
    { path: 'app', children: [
        { path: 'home', component: HomeComponent },
        { path: 'leagues', component: LeagueSelectorComponent },
        { path: 'leagues/:id', component: LeagueDetailComponent },
        { path: 'team', component: TeamComponent },
        { path: 'matches', component: MatchesComponent },
        { path: 'stats', component: StatsComponent },
        { path: 'locations', component: LocationsComponent },
        { path: 'admin', component: AdminComponent, canActivate: [adminGuard] },
        { path: 'feedback', component: FeedbackComponent },
        { path: '', redirectTo: '/app/home', pathMatch: 'full' }
    ]},
    { path: '**', redirectTo: '/' }
];
