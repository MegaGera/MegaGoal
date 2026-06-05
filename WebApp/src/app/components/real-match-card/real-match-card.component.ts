import { AfterViewInit, Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatchViewsCountBadgeComponent } from './match-views-count-badge/match-views-count-badge.component';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select'

import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamEyeCloseF, jamEyeF, jamInfoF } from '@ng-icons/jam-icons';

import { ImagesService } from '../../services/images.service';
import { MegaGoalService } from '../../services/megagoal.service';
import { LeagueColorsService } from '../../services/league-colors.service';
import { Match } from '../../models/match';
import { Location } from '../../models/location';
import { MatchParserService } from '../../services/match-parser.service';
import { isNotStartedStatus } from '../../config/matchStatus';


@Component({
  selector: 'app-real-match-card',
  standalone: true,
  imports: [
    NgIconComponent,
    CommonModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule,
    RouterLink,
    MatchViewsCountBadgeComponent,
  ],
  templateUrl: './real-match-card.component.html',
  styleUrl: './real-match-card.component.css',
  providers: [ImagesService, MegaGoalService, provideNgIconsConfig({
    size: window.innerWidth < 769 ? '1.2em' : '1.5em',
  }), provideIcons({ jamEyeCloseF, jamEyeF, jamInfoF })]
})
export class RealMatchCardComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() match!: Match;
  @Input() watched: boolean = false;
  @Input() locations!: Location[];
  @Input() size: string = 'lg';
  @Input() interactable: boolean = true;

  /** Session delta after mark/unmark watched (global watched_count is optimistic). */
  private viewsAdjustment = 0;

  /**
   * When false, views-badge slot snaps without CSS transition (avoids animate on first paint).
   * Set true after mount / fixture change so only user-driven 0↔N count toggles animate.
   */
  viewsBadgeAnimateTransitions = false;

  /** Drives slot width/opacity; stays true briefly after count→0 so collapse CSS can run */
  viewsBadgeSlotExpanded = false;

  /** Last positive count kept visible until collapse animation finishes */
  private viewsBadgeGhostCount = 0;

  private viewsBadgeCollapseKickTimer: ReturnType<typeof setTimeout> | null = null;
  private viewsBadgeGhostClearTimer: ReturnType<typeof setTimeout> | null = null;

  private static readonly VIEWS_BADGE_COLLAPSE_MS = 420;

  get viewsDisplayCount(): number {
    return Math.max(0, (this.match?.watched_count ?? 0) + this.viewsAdjustment);
  }

  /** Number shown in chip: ghost holds previous value during collapse transition */
  get viewsBadgeCountForChip(): number {
    const v = this.viewsDisplayCount;
    if (v > 0) {
      return v;
    }
    return this.viewsBadgeGhostCount;
  }

  /**
   * Location mat-select stays disabled until the user has "entered" the card
   * (mouse/focus) or touched it, with a short delay on touch so the same gesture
   * that applies :hover does not open the panel. CSS opacity alone still leaves
   * the control active; disabled blocks Material from handling the open.
   */
  locationSelectInteractable = false;
  locationPanelOpen = false;
  private locationInteractableTimer: ReturnType<typeof setTimeout> | null = null;
  private locationLeaveCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly TOUCH_ENABLE_DELAY_MS = 280;
  private static readonly LEAVE_PANEL_CHECK_MS = 150;

  constructor(
    public images: ImagesService,
    private megaGoal: MegaGoalService,
    public matchParser: MatchParserService,
    private router: Router,
    private leagueColorsService: LeagueColorsService
  ) {
    this.orderLocations();
  }

  ngAfterViewInit(): void {
    this.syncViewsBadgeSlot();
    this.enableViewsBadgeTransitionsDeferred();
  }

  /** Enables CSS transitions after the current paint (initial state stays instant). */
  private enableViewsBadgeTransitionsDeferred(): void {
    queueMicrotask(() => {
      this.viewsBadgeAnimateTransitions = true;
    });
  }

  /**
   * Keeps slot + ghost count in sync with viewsDisplayCount.
   * On collapse to 0, defers removing `--visible` and clearing ghost until after CSS transition
   * so max-width/opacity animate (inner badge used to unmount instantly and kill the effect).
   */
  private syncViewsBadgeSlot(): void {
    const v = this.viewsDisplayCount;

    if (v > 0) {
      this.clearViewsBadgeCollapseTimers();
      this.viewsBadgeGhostCount = v;
      this.viewsBadgeSlotExpanded = true;
      return;
    }

    if (!this.viewsBadgeSlotExpanded) {
      if (this.viewsBadgeGhostClearTimer == null) {
        this.viewsBadgeGhostCount = 0;
      }
      return;
    }

    if (!this.viewsBadgeAnimateTransitions) {
      this.clearViewsBadgeCollapseTimers();
      this.viewsBadgeSlotExpanded = false;
      this.viewsBadgeGhostCount = 0;
      return;
    }

    if (this.viewsBadgeCollapseKickTimer != null || this.viewsBadgeGhostClearTimer != null) {
      return;
    }

    this.viewsBadgeCollapseKickTimer = window.setTimeout(() => {
      this.viewsBadgeCollapseKickTimer = null;
      this.viewsBadgeSlotExpanded = false;
      this.viewsBadgeGhostClearTimer = window.setTimeout(() => {
        this.viewsBadgeGhostClearTimer = null;
        this.viewsBadgeGhostCount = 0;
      }, RealMatchCardComponent.VIEWS_BADGE_COLLAPSE_MS);
    }, 0);
  }

  private clearViewsBadgeCollapseTimers(): void {
    if (this.viewsBadgeCollapseKickTimer != null) {
      clearTimeout(this.viewsBadgeCollapseKickTimer);
      this.viewsBadgeCollapseKickTimer = null;
    }
    if (this.viewsBadgeGhostClearTimer != null) {
      clearTimeout(this.viewsBadgeGhostClearTimer);
      this.viewsBadgeGhostClearTimer = null;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['watched']) {
      this.resetLocationSelectInteraction();
    }
    const matchCh = changes['match'];
    if (
      matchCh &&
      matchCh.currentValue?.fixture?.id !== matchCh.previousValue?.fixture?.id
    ) {
      this.viewsAdjustment = 0;
      this.clearViewsBadgeCollapseTimers();
      this.viewsBadgeSlotExpanded = false;
      this.viewsBadgeGhostCount = 0;
      this.viewsBadgeAnimateTransitions = false;
      this.resetLocationSelectInteraction();
      this.enableViewsBadgeTransitionsDeferred();
      queueMicrotask(() => this.syncViewsBadgeSlot());
    } else if (matchCh) {
      this.syncViewsBadgeSlot();
    }
  }

  ngOnDestroy(): void {
    this.clearLocationInteractableTimer();
    this.clearLocationLeaveCheckTimer();
    this.clearViewsBadgeCollapseTimers();
  }

  onMatchCardPointerEnter(): void {
    this.scheduleLocationSelectInteractable(this.coarsePointerDelayMs());
  }

  onMatchCardTouchStart(): void {
    if (!this.canShowLocationSelect()) {
      return;
    }
    this.scheduleLocationSelectInteractable(RealMatchCardComponent.TOUCH_ENABLE_DELAY_MS);
  }

  onMatchCardPointerLeave(): void {
    this.clearLocationInteractableTimer();
    this.clearLocationLeaveCheckTimer();
    this.locationLeaveCheckTimer = setTimeout(() => {
      this.locationLeaveCheckTimer = null;
      if (!this.locationPanelOpen) {
        this.locationSelectInteractable = false;
      }
    }, RealMatchCardComponent.LEAVE_PANEL_CHECK_MS);
  }

  onLocationPanelOpenedChange(opened: boolean): void {
    this.locationPanelOpen = opened;
  }

  private scheduleLocationSelectInteractable(delayMs: number): void {
    if (!this.canShowLocationSelect()) {
      return;
    }
    this.clearLocationInteractableTimer();
    this.locationInteractableTimer = setTimeout(() => {
      this.locationSelectInteractable = true;
      this.locationInteractableTimer = null;
    }, delayMs);
  }

  private coarsePointerDelayMs(): number {
    if (typeof window === 'undefined') {
      return 0;
    }
    return window.matchMedia('(pointer: coarse)').matches
      ? RealMatchCardComponent.TOUCH_ENABLE_DELAY_MS
      : 0;
  }

  private canShowLocationSelect(): boolean {
    return this.interactable && this.watched && this.shouldShowMatchScore();
  }

  private resetLocationSelectInteraction(): void {
    this.clearLocationInteractableTimer();
    this.clearLocationLeaveCheckTimer();
    this.locationSelectInteractable = false;
    this.locationPanelOpen = false;
  }

  private clearLocationInteractableTimer(): void {
    if (this.locationInteractableTimer != null) {
      clearTimeout(this.locationInteractableTimer);
      this.locationInteractableTimer = null;
    }
  }

  private clearLocationLeaveCheckTimer(): void {
    if (this.locationLeaveCheckTimer != null) {
      clearTimeout(this.locationLeaveCheckTimer);
      this.locationLeaveCheckTimer = null;
    }
  }

  shouldShowMatchScore(): boolean {
    return !isNotStartedStatus(this.match?.status);
  }

  /** Tooltip on views badge: waiting vs started/finished */
  viewsBadgeMatchNotStarted(): boolean {
    return isNotStartedStatus(this.match?.status);
  }

  handleTeamClick(teamId: number): void {
    if (!this.interactable) {
      return;
    }
    this.navigateToTeam(teamId);
  }

  getDate(timestamp: number) {
    let date = new Date((timestamp * 1000));
    return new Date(timestamp * 1000).toLocaleDateString("en-GB");
  }

  getTime(timestamp: number) {
    let date = new Date((timestamp * 1000));
    return date.toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' });
  }

  createMatch() {
    if (!this.watched) {
      this.watched = true;
      this.viewsAdjustment += 1;
      this.resetLocationSelectInteraction();
      this.megaGoal.createMatch(this.matchParser.matchToMatchRequest(this.match)).subscribe(result => { });
      // Pointer may still be over the card; mouseenter will not fire again.
      setTimeout(() => this.onMatchCardPointerEnter(), 0);
    } else {
      this.watched = false;
      this.viewsAdjustment -= 1;
      this.resetLocationSelectInteraction();
      this.megaGoal.deleteMatch(this.match.fixture.id).subscribe(result => { });
    }
    this.syncViewsBadgeSlot();
  }

  /*
    Get dynamic styles for match card based on league colors
  */
  getMatchCardStyles(): any {
    if (!this.watched || !this.match) {
      return {};
    }
    
    const colors = this.leagueColorsService.getLeagueColors(this.match.league.id);
    return {
      'border': `2px solid ${colors.card_main_color}`,
      'box-shadow': `0 0 4px 2px ${colors.card_trans_color}, 0 4px 4px 0 ${colors.card_trans_color}`
    };
  }

  /*
    Get dynamic styles for team logo based on league colors
  */
  getTeamLogoStyles(): any {
    if (!this.watched || !this.match) {
      return {};
    }
    
    const colors = this.leagueColorsService.getLeagueColors(this.match.league.id);
    return {
      'box-shadow': `0 4px 4px 0 rgba(48,48,48, 0.15), var(--img-team-shadow) ${colors.card_trans_color}`
    };
  }

  setLocation(fixtureId: number, location: string) {
    const existingLocation = this.locations.find(loc => loc.venue_id === parseInt(location));
    if (existingLocation) {
      location = existingLocation.id;
    }
    this.megaGoal.setLocation(fixtureId, location, this.match.venue).subscribe(result => { });
  }

  getDefaultLeagueImg(event: any) {
    //event.target.src = environment.serverURL + "/assets/img/leagues/back/0.png"
  }

  isLive() {
    const liveStatuses = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT'];
    return liveStatuses.includes(this.match.status);
  }

  orderLocations() {
    if (this.locations) {
      this.locations.sort((a, b) => a.matchCount > b.matchCount ? -1 : 1);
    }
  }

  /*
    Parse the round name:
     - Regular Season - [N] -> Matchday - [N]
     - League Stage - [N] -> League R. - [N]
     - Group Stage - [N] -> Group R. - [N]
  */
  parseRoundName(round: string): string {
    // Regular Season - [n] -> Matchday - [n]
    const regularSeasonRegex = /^Regular Season - (\d+)$/;
    const regularSeasonMatch = round.match(regularSeasonRegex);
    if (regularSeasonMatch) {
      return `Matchday - ${regularSeasonMatch[1]}`;
    }

    // League Stage - [n] -> League R. - [n]
    const leagueStageRegex = /^League Stage - (\d+)$/;
    const leagueStageMatch = round.match(leagueStageRegex);
    if (leagueStageMatch) {
      return `League R. - ${leagueStageMatch[1]}`;
    }

    // Group Stage - [n] -> Group R. - [n]
    const groupStageRegex = /^Group Stage - (\d+)$/;
    const groupStageMatch = round.match(groupStageRegex);
    if (groupStageMatch) {
      return `Group R. - ${groupStageMatch[1]}`;
    }

    return round;
  }


  getLocationList() {
    return this.locations
      .filter(loc => !loc.stadium)
      .map(loc => ({ id: loc.id, name: loc.name }));
  }

  getLocationIdFromVenueId(venueId: number) {
    return this.locations.find(loc => loc.venue_id === venueId)?.id ?? venueId;
  }

  navigateToTeam(teamId: number) {
    this.router.navigate(['/app/team'], { queryParams: { id: teamId } }).then(() => {
      window.scrollTo(0, 0);
    });
  }

  navigateToMatchInfo() {
    this.router.navigate(['/app/match'], { queryParams: { id: this.match.fixture.id } }).then(() => {
      window.scrollTo(0, 0);
    });
  }
}
