import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MegaGoalService } from '../../../services/megagoal.service';
import { ImagesService } from '../../../services/images.service';
import {
  LeagueStandingsSummaryGroup,
  LeagueStandingsSummaryRow
} from '../../../models/leagueStandingsSummary';

@Component({
  selector: 'app-league-standings-table',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './league-standings-table.component.html',
  styleUrl: './league-standings-table.component.css'
})
export class LeagueStandingsTableComponent implements OnChanges {
  @Input({ required: true }) leagueId!: number;
  @Input({ required: true }) seasonId!: number;

  /** When true, omit the "Table" heading (e.g. mobile tab bar already shows it). */
  @Input() hideSectionTitle = false;

  /** After each load: whether there is at least one standings row (drives parent desktop layout). */
  @Output() hasStandingsChange = new EventEmitter<boolean>();

  groups: LeagueStandingsSummaryGroup[] = [];
  loaded = false;

  constructor(
    private megagoal: MegaGoalService,
    public images: ImagesService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['leagueId'] && !changes['seasonId']) {
      return;
    }
    const id = this.leagueId;
    const season = this.seasonId;
    if (id == null || Number.isNaN(id) || season == null || Number.isNaN(season)) {
      this.groups = [];
      this.loaded = false;
      this.hasStandingsChange.emit(false);
      return;
    }
    this.fetch(id, season);
  }

  trackRow(_index: number, row: LeagueStandingsSummaryRow): number {
    return row.team.id;
  }

  private fetch(leagueId: number, season: number): void {
    this.loaded = false;
    this.megagoal.getLeagueStandingsSummary(leagueId, season).subscribe({
      next: (res) => {
        this.groups = (res.groups ?? []).filter((g) => g.rows?.length > 0);
        this.loaded = true;
        this.hasStandingsChange.emit(this.groups.length > 0);
      },
      error: () => {
        this.groups = [];
        this.loaded = true;
        this.hasStandingsChange.emit(false);
      }
    });
  }
}
