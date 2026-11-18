import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { Observable, of, Subscription, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelect, MatSelectModule } from '@angular/material/select';

import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamEyeCloseF, jamEyeF } from '@ng-icons/jam-icons';

import { ImagesService } from '../../services/images.service';
import { MegaGoalService } from '../../services/megagoal.service';
import { MatchParserService } from '../../services/match-parser.service';
import { LeagueColorsService } from '../../services/league-colors.service';
import { isNotStartedStatus } from '../../config/matchStatus';
import { RealMatch } from '../../models/realMatch';
import { Match } from '../../models/match';
import { Location } from '../../models/location';
import { NewLocationDialogComponent, NewLocationDraft } from '../locations/new-location-dialog/new-location-dialog.component';
import { MatchViewsCountBadgeComponent } from '../real-match-card/match-views-count-badge/match-views-count-badge.component';
import { bindLocationPanelToCard } from '../real-match-card/location-select-panel';
import { BodyDialogPortal } from '../real-match-card/body-dialog-portal';

@Component({
  selector: 'app-general-match-card',
  standalone: true,
  imports: [NgIconComponent, CommonModule, MatFormFieldModule, MatSelectModule, FormsModule, MatchViewsCountBadgeComponent, NewLocationDialogComponent],
  templateUrl: './general-match-card.component.html',
  styleUrl: './general-match-card.component.css',
  providers: [ImagesService, MegaGoalService, provideNgIconsConfig({
    size: '1.2em',
  }), provideIcons({ jamEyeCloseF, jamEyeF })]
})
export class GeneralMatchCardComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild(MatSelect)
  set locationSelect(select: MatSelect | undefined) {
    if (select === this.watchedLocationSelect) {
      return;
    }
    this.locationPanelAttach?.unsubscribe();
    this.locationPanelAttach = undefined;
    this.watchedLocationSelect = select;
    this.locationPanelAttach = bindLocationPanelToCard(
      select,
      () => this.host.nativeElement.querySelector('.match-card-container')
    );
  }
  @ViewChild('newLocationBackdrop') private newLocationBackdrop?: ElementRef<HTMLElement>;
  private watchedLocationSelect?: MatSelect;
  private locationPanelAttach?: Subscription;
  private newLocationPortal = new BodyDialogPortal();
  @Input() realMatch!: RealMatch;
  @Output() watchedChange = new EventEmitter<boolean>();
  @Output() watchedMatchChange = new EventEmitter<Match | null>();

  match!: Match;
  watched: boolean = false;
  locations: Location[] = [];
  newLocationOpen = false;
  newLocationError = '';
  savingLocation = false;

  private viewsAdjustment = 0;

  get viewsDisplayCount(): number {
    const base = this.realMatch.watched_count ?? this.match?.watched_count ?? 0;
    return Math.max(0, base + this.viewsAdjustment);
  }

  viewsBadgeMatchNotStarted(): boolean {
    return isNotStartedStatus(this.realMatch?.fixture?.status?.short);
  }

  constructor(
    public images: ImagesService, 
    private megaGoal: MegaGoalService, 
    public matchParser: MatchParserService,
    private router: Router,
    private leagueColorsService: LeagueColorsService,
    private host: ElementRef<HTMLElement>
  ) {}

  ngOnDestroy(): void {
    this.locationPanelAttach?.unsubscribe();
    this.newLocationPortal.detach();
  }

  ngOnInit() {
    this.loadMatchData();
    this.getLocations();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const rm = changes['realMatch'];
    if (rm && rm.currentValue?.fixture?.id !== rm.previousValue?.fixture?.id) {
      this.viewsAdjustment = 0;
    }
  }

  loadMatchData() {
    // Check if match is already watched
    this.megaGoal.getMatchesByFixtureId(this.realMatch.fixture.id).subscribe((result: Match[]) => {
      if (result && result.length > 0) {
        this.match = result[0];
        this.watched = true;
        this.emitWatchedState();
      } else {
        this.match = this.matchParser.realMatchToMatch(this.realMatch);
        this.watched = false;
        this.emitWatchedState();
      }
    }, (error: any) => {
      this.match = this.matchParser.realMatchToMatch(this.realMatch);
      this.watched = false;
      this.emitWatchedState();
    });
  }

  private emitWatchedState(): void {
    this.watchedChange.emit(this.watched);
    this.watchedMatchChange.emit(this.watched ? this.match : null);
  }

  getLocations() {
    this.megaGoal.getLocationsCounts().subscribe(result => {
      this.locations = <Location[]>result;
      this.orderLocations();
    });
  }

  orderLocations() {
    if (this.locations) {
      this.locations.sort((a, b) => a.matchCount > b.matchCount ? -1 : 1);
    }
  }

  getDate(timestamp: number) {
    return new Date(timestamp * 1000).toLocaleDateString("en-GB", {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getTime(timestamp: number) {
    let date = new Date((timestamp * 1000));
    return date.toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' });
  }

  markAsWatchedIfNeeded(): Observable<void> {
    if (this.watched) {
      return of(void 0);
    }

    this.watched = true;
    this.viewsAdjustment += 1;
    this.emitWatchedState();

    return this.megaGoal.createMatch(this.matchParser.matchToMatchRequest(this.match)).pipe(
      tap(() => this.loadMatchData()),
      map(() => void 0),
      catchError((error) => {
        this.watched = false;
        this.viewsAdjustment -= 1;
        this.emitWatchedState();
        return throwError(() => error);
      })
    );
  }

  createMatch() {
    if (!this.watched) {
      this.markAsWatchedIfNeeded().subscribe();
    } else {
      this.watched = false;
      this.viewsAdjustment -= 1;
      this.emitWatchedState();
      this.megaGoal.deleteMatch(this.match.fixture.id).subscribe(result => {});
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.newLocationOpen && !this.savingLocation) {
      this.closeNewLocation();
    }
  }

  openNewLocation(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.watchedLocationSelect?.close();
    this.newLocationError = '';
    this.newLocationOpen = true;
    setTimeout(() => {
      const backdrop = this.newLocationBackdrop?.nativeElement;
      if (backdrop) {
        this.newLocationPortal.attach(backdrop);
      }
    });
  }

  closeNewLocation(): void {
    if (this.savingLocation) {
      return;
    }
    this.newLocationPortal.detach();
    this.newLocationOpen = false;
    this.newLocationError = '';
  }

  saveNewLocation(draft: NewLocationDraft): void {
    const name = draft.name.trim();
    if (!name || this.savingLocation || !this.match) {
      return;
    }
    const existing = this.locations.find((loc) =>
      !loc.stadium && loc.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      this.applyLocation(existing.id);
      this.closeNewLocation();
      return;
    }
    this.savingLocation = true;
    this.newLocationError = '';
    this.megaGoal.createLocation({ name }).subscribe({
      next: (created) => {
        const finish = (place = draft.place) => {
          this.locations.push({
            name: created.name,
            id: created.id,
            user: { username: '' },
            private: true,
            stadium: false,
            official: Boolean(place?.osmId),
            matchCount: 0,
            ...(place ? { place } : {})
          });
          this.orderLocations();
          this.applyLocation(created.id);
          this.savingLocation = false;
          this.closeNewLocation();
        };
        if (!draft.place) {
          finish(null);
          return;
        }
        this.megaGoal.setLocationPlace(created.id, draft.place).subscribe({
          next: (updated) => finish(updated.place),
          error: () => finish(null)
        });
      },
      error: () => {
        this.savingLocation = false;
        this.newLocationError = 'Could not save that location.';
      }
    });
  }

  setLocation(fixtureId: number, location: string | number) {
    const locationId = String(location);
    const selectedVenue = this.match.venue?.id != null
      && locationId === this.getLocationIdFromVenueId(this.match.venue.id);

    const existingLocation = this.locations.find(loc => loc.venue_id === parseInt(locationId, 10));
    const resolvedLocation = existingLocation?.id ?? locationId;

    const venue = selectedVenue ? this.match.venue : undefined;
    this.match.location = resolvedLocation;
    this.megaGoal.setLocation(fixtureId, resolvedLocation, venue).subscribe(result => {});
  }

  private applyLocation(locationId: string): void {
    this.setLocation(this.match.fixture.id, locationId);
  }

  getLocationList() {
    return this.locations
      .filter(loc => !loc.stadium)
      .map(loc => ({ id: loc.id, name: loc.name }));
  }

  getLocationIdFromVenueId(venueId: number): string {
    return this.locations.find(loc => loc.venue_id === venueId)?.id ?? String(venueId);
  }

  navigateToTeam(teamId: number) {
    this.router.navigate(['/app/team'], { 
      queryParams: { id: teamId, view: 'insights' } 
    }).then(() => {
      window.scrollTo(0, 0);
    });
  }

  /*
    Get dynamic styles for match card container based on league colors
  */
  getMatchCardStyles(): any {
    if (!this.watched || !this.realMatch) {
      return {};
    }
    
    const colors = this.leagueColorsService.getLeagueColors(this.realMatch.league.id);
    return {
      'border': `3px solid ${colors.card_main_color}`,
      'box-shadow': `0 0 8px 2px ${colors.card_trans_color}`
    };
  }

  /*
    Get dynamic styles for team logo based on league colors
  */
  getTeamLogoStyles(): any {
    if (!this.watched || !this.realMatch) {
      return {};
    }
    
    const colors = this.leagueColorsService.getLeagueColors(this.realMatch.league.id);
    const shadowSpread = this.getTeamLogoShadowSpread();
    return {
      'box-shadow': `0 6px 12px 0 rgba(48,48,48, 0.12), 0 0 0 ${shadowSpread}px ${colors.card_trans_color}`
    };
  }

  /*
    Handle team logo hover
  */
  onTeamLogoHover(event: MouseEvent): void {
    if (!this.watched || !this.realMatch) return;
    const target = event.currentTarget as HTMLElement;
    const colors = this.leagueColorsService.getLeagueColors(this.realMatch.league.id);
    const shadowSpread = this.getTeamLogoShadowSpread();
    target.style.boxShadow = `0 8px 16px 0 rgba(48,48,48, 0.18), 0 0 0 ${shadowSpread}px ${colors.card_trans_color}`;
  }

  /*
    Handle team logo leave
  */
  onTeamLogoLeave(event: MouseEvent): void {
    if (!this.watched || !this.realMatch) return;
    const target = event.currentTarget as HTMLElement;
    const styles = this.getTeamLogoStyles();
    target.style.boxShadow = styles['box-shadow'] || '';
  }

  /*
    Keep team logo shadow ring proportional on small screens
  */
  private getTeamLogoShadowSpread(): number {
    if (typeof window === 'undefined') {
      return 10;
    }

    return window.innerWidth <= 768 ? 5 : 10;
  }
}

