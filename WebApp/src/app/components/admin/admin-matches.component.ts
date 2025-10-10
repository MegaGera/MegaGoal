import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MegaGoalService } from '../../services/megagoal.service';
import { UpdaterService } from '../../services/updater.service';
import { RealMatch } from '../../models/realMatch';
import { LeaguesSettings } from '../../models/leaguesSettings';
import { shortTeam } from '../../models/team';
import { isNotStartedStatus } from '../../config/matchStatus';

@Component({
  selector: 'app-admin-matches',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-matches.component.html',
  styleUrl: './admin-matches.component.css'
})
export class AdminMatchesComponent {

  filteredMatches: RealMatch[] = [];
  matchesWithoutStats: RealMatch[] = [];

  // Filters sources
  leagues: LeaguesSettings[] = [];
  seasons: { id: number, text: string }[] = [];
  teams: shortTeam[] = [];
  filteredTeams: shortTeam[] = [];
  countries: string[] = [];

  selectedLeague: LeaguesSettings | null = null;
  selectedSeason: { id: number, text: string } | null = null;
  selectedTeamId_1: number | null = null;
  selectedTeamId_2: number | null = null;
  selectedCountry: string | null = null;

  loading = false;
  loadingWithoutStats = false;
  updatingFixtureId: number | null = null;

  // Pagination for matches without statistics
  currentPage = 1;
  totalPages = 0;
  totalMatches = 0;

  constructor(
    private megagoal: MegaGoalService,
    private updater: UpdaterService
  ) {
    this.init();
  }

  init() {
    this.loading = true;
    // Load leagues settings and teams for filters
    this.megagoal.getLeaguesSettings().subscribe({
      next: (ls) => {
        this.leagues = (ls || []) as LeaguesSettings[];
        // Build countries list from leagues settings
        const cset = new Set<string>();
        for (const l of this.leagues) {
          if ((l as any).country) cset.add((l as any).country);
        }
        this.countries = Array.from(cset.values()).sort((a, b) => a.localeCompare(b));
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
    this.megagoal.getTeamsByTopLeague().subscribe({
      next: (teams) => { this.teams = teams || []; this.filterTeamsByLeagueAndSeason(); },
      error: () => {}
    });
    // Load matches without statistics
    this.loadMatchesWithoutStatistics();
  }

  loadMatchesWithoutStatistics(page: number = 1) {
    this.loadingWithoutStats = true;
    this.currentPage = page;
    this.megagoal.getRealMatchesWithoutStatistics(page).subscribe({
      next: (response) => {
        this.matchesWithoutStats = response.matches || [];
        this.totalMatches = response.total || 0;
        this.totalPages = response.totalPages || 0;
        this.currentPage = response.page || 1;
        this.loadingWithoutStats = false;
      },
      error: () => {
        this.matchesWithoutStats = [];
        this.loadingWithoutStats = false;
      }
    });
  }

  onLeagueChange() {
    // Seasons from league available_seasons
    if (this.selectedLeague && (this.selectedLeague as any).available_seasons) {
      const arr = (this.selectedLeague as any).available_seasons as Array<any>;
      this.seasons = arr
        .map(s => ({ id: s.season, text: s.season.toString() }))
        .sort((a, b) => b.id - a.id);
    } else {
      this.seasons = [];
    }
    // Reset season/teams
    this.selectedSeason = null;
    this.selectedTeamId_1 = null;
    this.selectedTeamId_2 = null;
    this.filterTeamsByLeagueAndSeason();
    this.applyFilters();
  }

  applyFilters() {
    const params: any = {};
    const selectedCount = [
      this.selectedLeague ? 1 : 0,
      this.selectedSeason ? 1 : 0,
      this.selectedTeamId_1 ? 1 : 0,
      this.selectedTeamId_2 ? 1 : 0
    ].reduce((a, b) => a + b, 0);

    if (this.selectedLeague) params.league_id = this.selectedLeague.league_id;
    if (this.selectedSeason) params.season = this.selectedSeason.id;
    if (this.selectedTeamId_1) params.team_id = this.selectedTeamId_1;
    if (this.selectedTeamId_2) params.team_2_id = this.selectedTeamId_2;
    if (this.selectedCountry) params.country = this.selectedCountry;

    if (selectedCount >= 2) {
      this.loading = true;
      this.megagoal.getRealMatchesByParameters(params).subscribe({
        next: (matches) => { this.filteredMatches = matches || []; this.loading = false; },
        error: () => { this.filteredMatches = []; this.loading = false; }
      });
    } else {
      this.filteredMatches = [];
    }
  }

  clearFilters() {
    this.selectedLeague = null;
    this.selectedSeason = null;
    this.selectedTeamId_1 = null;
    this.selectedTeamId_2 = null;
    this.filterTeamsByLeagueAndSeason();
    this.applyFilters();
  }

  hasStatistics(m: RealMatch): boolean {
    return Array.isArray((m as any).statistics) && ((m as any).statistics as any[]).length > 0;
  }

  isNotStarted(m: RealMatch): boolean {
    return isNotStartedStatus(m.fixture.status?.short);
  }

  updateStatistics(m: RealMatch) {
    this.updatingFixtureId = m.fixture.id;
    this.updater.updateMatchStatistics(m.fixture.id).subscribe({
      next: () => {
        this.updatingFixtureId = null;
        this.applyFilters();
        // Reload matches without statistics to update the list
        this.loadMatchesWithoutStatistics(this.currentPage);
      },
      error: () => {
        this.updatingFixtureId = null;
      }
    });
  }

  filterTeamsByLeagueAndSeason() {
    if (!this.selectedLeague && !this.selectedSeason) {
      this.filteredTeams = [...this.teams];
      return;
    }
    this.filteredTeams = this.teams.filter(team => {
      if (!(team as any).seasons || (team as any).seasons.length === 0) return false;
      return (team as any).seasons.some((s: any) => {
        let leagueMatches = true;
        let seasonMatches = true;
        if (this.selectedLeague) {
          leagueMatches = s.league === this.selectedLeague!.league_id.toString();
        }
        if (this.selectedSeason) {
          seasonMatches = s.season === this.selectedSeason!.id.toString();
        }
        return leagueMatches && seasonMatches;
      });
    });

    if (this.selectedTeamId_1 && !this.filteredTeams.find(t => t.id === this.selectedTeamId_1)) {
      this.selectedTeamId_1 = null;
    }
    if (this.selectedTeamId_2 && !this.filteredTeams.find(t => t.id === this.selectedTeamId_2)) {
      this.selectedTeamId_2 = null;
    }
    if (!this.selectedTeamId_1) this.selectedTeamId_2 = null;
  }
}


