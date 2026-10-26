import { Component, HostBinding, Input } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { SeasonInfo } from '../../models/season';
import { Location } from '../../models/location';
import { LeagueStats, TeamsViewedStats } from '../../models/league';
import { ImagesService } from '../../services/images.service';
import { LeagueColorsService } from '../../services/league-colors.service';

@Component({
  selector: 'app-active-filter-badges',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage],
  templateUrl: './active-filter-badges.component.html',
  styleUrl: './active-filter-badges.component.css',
  providers: [ImagesService],
})
export class ActiveFilterBadgesComponent {
  /** 0=All (hidden), 1=Clubs, 2=Nations */
  @Input() panelChip = 0;
  @Input() showPanelChip = true;

  @Input() season: SeasonInfo | null = null;
  @Input() locationId = '';
  @Input() locations: Location[] = [];

  @Input() leagueIds: number[] = [];
  @Input() leagues: LeagueStats[] = [];

  @Input() teamIds: number[] = [];
  @Input() teams: TeamsViewedStats[] = [];
  @Input() teamAgainstIds: number[] = [];
  @Input() teamsAgainst: TeamsViewedStats[] = [];

  /** Team page: locked primary club. */
  @Input() primaryTeam: { id: number; name: string } | null = null;
  /**
   * Team page: hide the page team unless opponents are selected;
   * then show primary + vs + opponents.
   */
  @Input() hidePrimaryTeamUnlessVs = false;

  constructor(
    public images: ImagesService,
    private leagueColors: LeagueColorsService,
  ) {}

  @HostBinding('style.display')
  get hostDisplay(): string {
    return this.hasAny ? 'block' : 'none';
  }

  get panelChipLabel(): string | null {
    if (!this.showPanelChip) {
      return null;
    }
    if (this.panelChip === 1) {
      return 'Clubs';
    }
    if (this.panelChip === 2) {
      return 'Nations';
    }
    return null;
  }

  get seasonLabel(): string | null {
    if (!this.season || this.season.id === 0) {
      return null;
    }
    return this.season.text || null;
  }

  get locationLabel(): string | null {
    if (!this.locationId) {
      return null;
    }
    const loc = this.locations.find((l) => l.id === this.locationId);
    return loc?.name ?? null;
  }

  get displayTeamIds(): number[] {
    if (this.hidePrimaryTeamUnlessVs) {
      return [];
    }
    return this.teamIds;
  }

  get showPrimaryWithVs(): boolean {
    return (
      this.hidePrimaryTeamUnlessVs &&
      !!this.primaryTeam &&
      this.teamAgainstIds.length > 0
    );
  }

  /** Against badges after selected teams on list/home pages */
  get showTeamAgainstAfterTeams(): boolean {
    return this.teamAgainstIds.length > 0 && this.displayTeamIds.length > 0 && !this.hidePrimaryTeamUnlessVs;
  }

  get hasAny(): boolean {
    return (
      !!this.panelChipLabel ||
      !!this.seasonLabel ||
      !!this.locationLabel ||
      this.leagueIds.length > 0 ||
      this.displayTeamIds.length > 0 ||
      this.showPrimaryWithVs
    );
  }

  teamName(id: number): string {
    if (this.primaryTeam?.id === id) {
      return this.primaryTeam.name;
    }
    const fromTeams = this.teams.find((t) => t.team_id === id);
    if (fromTeams) {
      return fromTeams.team_name;
    }
    const fromAgainst = this.teamsAgainst.find((t) => t.team_id === id);
    return fromAgainst?.team_name ?? `Team ${id}`;
  }

  leagueName(id: number): string {
    return this.leagues.find((l) => l.league_id === id)?.league_name ?? `League ${id}`;
  }

  leagueBorderColor(leagueId: number): string {
    return this.leagueColors.getLeagueColors(leagueId).card_main_color;
  }
}
