import { Component, HostBinding, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, NgClass, NgOptimizedImage } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamSettingsAlt, jamChevronUp, jamChevronDown, jamSearch, jamClose } from '@ng-icons/jam-icons';
import { SeasonInfo } from '../../models/season';
import { LeagueStats, TeamsViewedStats } from '../../models/league';
import { Location } from '../../models/location';
import { ImagesService } from '../../services/images.service';
import { GeneralCardComponent } from '../general-card/general-card.component';

@Component({
  selector: 'app-filters-home',
  standalone: true,
  imports: [
    CommonModule, 
    NgClass, 
    NgOptimizedImage, 
    MatChipsModule, 
    FormsModule, 
    NgIconComponent, 
    GeneralCardComponent
  ],
  templateUrl: './filters-home.component.html',
  styleUrls: ['./filters-home.component.css'],
  providers: [
    ImagesService,
    provideIcons({ jamSettingsAlt, jamChevronUp, jamChevronDown, jamSearch, jamClose }),
    provideNgIconsConfig({ size: '1em' })
  ]
})
export class FiltersHomeComponent {
  @Input() filterPanelChipSelected: number = 1;
  @Input() filterLeagueSelected: number[] = [];
  @Input() filterTeamSelected: number[] = [];
  @Input() filterSeasonSelected!: SeasonInfo;
  @Input() filterLocationSelected: string = '';
  @Input() filterOrder: 'date_desc' | 'date_asc' | 'goals_desc' | 'goals_asc' = 'date_desc';
  @Input() seasons: SeasonInfo[] = [];
  @Input() locations: Location[] = [];
  @Input() leaguesViewed: LeagueStats[] = [];
  @Input() leaguesLoaded: boolean = false;
  /** Rows from /teams-viewed intersected with match context (same pattern as leagues). */
  @Input() teamsViewed: TeamsViewedStats[] = [];
  @Input() teamsLoaded: boolean = false;
  /** Home page only: enable name search in the Teams picker. */
  @Input() enableTeamsSearch: boolean = false;
  @Input() showPanelChips: boolean = true;
  @Input() showLeagues: boolean = true;
  /** When false, team grid is hidden (e.g. team page reuse without team picker data). */
  @Input() showTeams: boolean = false;
  /** Team page: section title (default "Teams", team page uses "TEAM"). */
  @Input() teamsSectionTitle: string = 'Teams';
  /** When set, show a single locked badge (not togglable) instead of the multi-select grid. */
  @Input() teamPrimaryLocked: { id: number; name: string } | null = null;
  /** Opponent picker (home only): shown when primary teams are selected. */
  @Input() showTeamAgainst: boolean = false;
  @Input() filterTeamAgainstSelected: number[] = [];
  @Input() teamsAgainstViewed: TeamsViewedStats[] = [];
  @Input() teamsAgainstLoaded: boolean = true;
  @Input() showLocations: boolean = true;
  /** When false, Order select is hidden (e.g. players page uses server ranking). */
  @Input() showOrder: boolean = true;
  @Input() collapsed: boolean = false;
  /** When true and collapsed, header is a single settings icon aligned right (no title/chevron). */
  @Input() iconOnlyCollapsed: boolean = false;

  @HostBinding('class.filters-home--icon-only-collapsed')
  get iconOnlyCollapsedActive(): boolean {
    return this.iconOnlyCollapsed && this.collapsed;
  }

  @Output() filterPanelChipSelectedChange = new EventEmitter<number>();
  @Output() filterLeagueSelectedChange = new EventEmitter<number[]>();
  @Output() filterTeamSelectedChange = new EventEmitter<number[]>();
  @Output() filterTeamAgainstSelectedChange = new EventEmitter<number[]>();
  @Output() filterSeasonSelectedChange = new EventEmitter<SeasonInfo>();
  @Output() filterLocationSelectedChange = new EventEmitter<string>();
  @Output() filterOrderChange = new EventEmitter<'date_desc' | 'date_asc' | 'goals_desc' | 'goals_asc'>();
  @Output() resetFiltersChange = new EventEmitter<void>();
  @Output() collapseToggle = new EventEmitter<void>();

  showAllLeagues = false;
  showAllTeams = false;
  showAllTeamsAgainst = false;

  /** Substring filter on team names (case-insensitive). */
  teamSearchQuery = '';
  /** Substring filter on opponent names (case-insensitive); does not affect selected chips until user toggles. */
  teamAgainstSearchQuery = '';

  constructor(public images: ImagesService) {}

  private teamsPassesSearch(t: TeamsViewedStats): boolean {
    const q = this.teamSearchQuery.trim().toLowerCase();
    if (!q) {
      return true;
    }
    return (t.team_name ?? '').toLowerCase().includes(q);
  }

  private teamsAgainstPassesSearch(t: TeamsViewedStats): boolean {
    const q = this.teamAgainstSearchQuery.trim().toLowerCase();
    if (!q) {
      return true;
    }
    return (t.team_name ?? '').toLowerCase().includes(q);
  }

  /** Full list with selected teams first (no slice). */
  get filteredTeamsOrdered(): TeamsViewedStats[] {
    const selectedSet = new Set(this.filterTeamSelected);
    const pool = this.teamsViewed.filter((t) => this.teamsPassesSearch(t) || selectedSet.has(t.team_id));
    const selectedTeams = pool.filter(team => selectedSet.has(team.team_id));
    const nonSelectedTeams = pool.filter(team => !selectedSet.has(team.team_id));
    return [...selectedTeams, ...nonSelectedTeams];
  }

  /** Display list: first 4 when collapsed; full list when expanded (scroll wraps when many). */
  get filteredTeams(): TeamsViewedStats[] {
    const reordered = this.filteredTeamsOrdered;
    return this.showAllTeams ? reordered : reordered.slice(0, 4);
  }

  get filteredTeamsAgainstOrdered(): TeamsViewedStats[] {
    const selectedSet = new Set(this.filterTeamAgainstSelected);
    const pool = this.teamsAgainstViewed.filter(
      (t) => this.teamsAgainstPassesSearch(t) || selectedSet.has(t.team_id)
    );
    const sel = pool.filter((t) => selectedSet.has(t.team_id));
    const rest = pool.filter((t) => !selectedSet.has(t.team_id));
    return [...sel, ...rest];
  }

  get filteredTeamsAgainst(): TeamsViewedStats[] {
    const reordered = this.filteredTeamsAgainstOrdered;
    return this.showAllTeamsAgainst ? reordered : reordered.slice(0, 4);
  }

  // Computed property to reorder leagues by selection (leagues are already filtered by parent)
  get filteredLeagues(): LeagueStats[] {
    // Reorder: selected leagues first, then non-selected leagues
    const selectedLeagues = this.leaguesViewed.filter(league => this.filterLeagueSelected.includes(league.league_id));
    const nonSelectedLeagues = this.leaguesViewed.filter(league => !this.filterLeagueSelected.includes(league.league_id));
    
    const reorderedLeagues = [...selectedLeagues, ...nonSelectedLeagues];
    
    // If not showing all leagues, limit to first 4
    return this.showAllLeagues ? reorderedLeagues : reorderedLeagues.slice(0, 4);
  }

  changeFilterPanelChipSelected(chip: number) {
    this.filterPanelChipSelected = chip;
    this.filterPanelChipSelectedChange.emit(chip);
  }

  changeFilterLeagueSelected(league: number) {
    let newFilterLeagueSelected: number[];
    if (this.filterLeagueSelected.includes(league)) {
      newFilterLeagueSelected = this.filterLeagueSelected.filter(item => item !== league);
    } else {
      newFilterLeagueSelected = [...this.filterLeagueSelected, league];
    }
    this.filterLeagueSelected = newFilterLeagueSelected;
    this.filterLeagueSelectedChange.emit(newFilterLeagueSelected);
  }

  changeFilterSeasonSelected(season: SeasonInfo) {
    this.filterSeasonSelected = season;
    this.filterSeasonSelectedChange.emit(season);
  }

  changeFilterLocationSelected(location: string) {
    this.filterLocationSelected = location;
    this.filterLocationSelectedChange.emit(location);
  }

  changeFilterOrder(order: 'date_desc' | 'date_asc' | 'goals_desc' | 'goals_asc') {
    this.filterOrder = order;
    this.filterOrderChange.emit(order);
  }

  toggleLeaguesVisibility() {
    this.showAllLeagues = !this.showAllLeagues;
  }

  toggleTeamsVisibility() {
    this.showAllTeams = !this.showAllTeams;
  }

  toggleTeamsAgainstVisibility() {
    this.showAllTeamsAgainst = !this.showAllTeamsAgainst;
  }

  clearTeamSearch(): void {
    this.teamSearchQuery = '';
    this.showAllTeams = false;
  }

  onTeamSearchChange(): void {
    this.showAllTeams = false;
  }

  clearTeamAgainstSearch(): void {
    this.teamAgainstSearchQuery = '';
    this.showAllTeamsAgainst = false;
  }

  onTeamAgainstSearchChange(): void {
    this.showAllTeamsAgainst = false;
  }

  changeFilterTeamSelected(teamId: number) {
    let next: number[];
    if (this.filterTeamSelected.includes(teamId)) {
      next = this.filterTeamSelected.filter(item => item !== teamId);
    } else {
      next = [...this.filterTeamSelected, teamId];
    }
    this.filterTeamSelected = next;
    this.filterTeamSelectedChange.emit(next);
  }

  changeFilterTeamAgainstSelected(teamId: number) {
    let next: number[];
    if (this.filterTeamAgainstSelected.includes(teamId)) {
      next = this.filterTeamAgainstSelected.filter((item) => item !== teamId);
    } else {
      next = [...this.filterTeamAgainstSelected, teamId];
    }
    this.filterTeamAgainstSelected = next;
    this.filterTeamAgainstSelectedChange.emit(next);
  }

  resetFilters() {
    this.showAllLeagues = false;
    this.showAllTeams = false;
    this.showAllTeamsAgainst = false;
    this.teamSearchQuery = '';
    this.teamAgainstSearchQuery = '';
    this.resetFiltersChange.emit();
  }

  onCollapseToggle(): void {
    this.collapseToggle.emit();
  }
} 