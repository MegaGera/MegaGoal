import { Routes } from '@angular/router';
import { LeagueSelectorComponent } from './components/league-selector/league-selector.component';
import { LeagueDetailComponent } from './components/league-detail/league-detail.component';
import { TeamComponent } from './components/team/team.component';
import { HomeComponent } from './components/home/home.component';
import { LocationsComponent } from './components/locations/locations.component';
import { AdminComponent } from './components/admin/admin.component';
import { FeedbackComponent } from './components/feedback/feedback.component';
import { ProfileComponent } from './components/profile/profile.component';
import { MatchesComponent } from './components/matches/matches.component';
import { LandingPageComponent } from './components/landing-page/landing-page.component';
import { MatchInfoComponent } from './components/match-info/match-info.component';
import { PlayerInfoComponent } from './components/player-info/player-info.component';
import { PlayersComponent } from './components/players/players.component';
import { TeamsComponent } from './components/teams/teams.component';

import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
    { path: '', component: LandingPageComponent },
    { path: 'app', children: [
        { path: 'home', component: HomeComponent, data: { reuseList: true } },
        { path: 'leagues', component: LeagueSelectorComponent },
        { path: 'leagues/:id', component: LeagueDetailComponent },
        { path: 'team', component: TeamComponent },
        { path: 'teams', component: TeamsComponent, data: { reuseList: true } },
        { path: 'matches', component: MatchesComponent, data: { reuseList: true } },
        { path: 'match', component: MatchInfoComponent, data: { reuseList: true } },
        { path: 'players', component: PlayersComponent, data: { reuseList: true } },
        { path: 'player', component: PlayerInfoComponent },
        { path: 'locations', component: LocationsComponent },
        { path: 'admin', component: AdminComponent, canActivate: [adminGuard] },
        { path: 'feedback', component: FeedbackComponent },
        { path: 'profile', component: ProfileComponent },
        { path: '', redirectTo: '/app/home', pathMatch: 'full' }
    ]},
    { path: '**', redirectTo: '/' }
];
