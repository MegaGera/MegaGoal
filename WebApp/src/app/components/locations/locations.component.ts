import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NgOptimizedImage } from '@angular/common';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';

import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamShieldF, jamEyeF, jamPlus, jamMinus, jamFilter, jamSearch, jamClose, jamChevronLeft, jamTrash } from '@ng-icons/jam-icons';

import { MegaGoalService } from '../../services/megagoal.service';
import { ImagesService } from '../../services/images.service';
import { DEFAULT_MAP_STADIUMS, lastMapPin, Location, LocationPlace, LocationPlaceResult, rememberMapPin } from '../../models/location';
import { LocationMapComponent, LocationMapPin } from './location-map/location-map.component';
import { NewLocationDialogComponent, NewLocationDraft } from './new-location-dialog/new-location-dialog.component';
import { RealMatch } from '../../models/realMatch';
import { Match } from '../../models/match';
import { LeaguesSettings } from '../../models/leaguesSettings';
import { shortTeam } from '../../models/team';
import { SeasonInfo } from '../../models/season';
import { MatchParserService } from '../../services/match-parser.service';
import { PaginationComponent } from '../pagination/pagination.component';

@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [FormsModule, NgIconComponent, CommonModule, NgOptimizedImage, MatFormFieldModule, MatAutocompleteModule, MatInputModule, LocationMapComponent, NewLocationDialogComponent, PaginationComponent],
  templateUrl: './locations.component.html',
  styleUrl: './locations.component.css',
  providers: [provideNgIconsConfig({
    size: '1.5em',
  }), provideIcons({ jamShieldF, jamEyeF, jamPlus, jamMinus, jamFilter, jamSearch, jamClose, jamChevronLeft, jamTrash })]
})
export class LocationsComponent implements OnInit {

  locations: Location[] = [];
  selectedLocation: Location | null = null;
  locationSearchQuery = '';
  newLocationOpen = false;
  newLocationError = '';
  savingLocation = false;
  private pendingSelectLocationId: string | null = null;
  placeQuery = '';
  locationNameDraft = '';
  savingLocationName = false;
  locationListFilter: 'all' | 'map' | 'stadium' = 'all';
  private previewPin: { lat: number; lng: number } | null = null;
  private stadiumView: { lat: number; lng: number; title: string; address: string } | null = null;
  private mapSelectionId: string | null = null;
  private overviewPinsCache: { key: string; pins: LocationMapPin[] } = { key: '', pins: [] };
  placeResults: LocationPlaceResult[] = [];
  searchingPlaces = false;
  savingPlace = false;
  deleteLocationOpen = false;
  deletingLocation = false;
  deleteLocationError = '';
  placeError = '';
  draftPin: { lat: number; lng: number } | null = null;
  private placeSearchSerial = 0;
  private placeSearchTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Left column - Available matches
  availableRealMatches: RealMatch[] = [];
  filteredRealMatches: RealMatch[] = [];
  pagedRealMatches: RealMatch[] = [];
  leagues: LeaguesSettings[] = [];
  displayLeagues: LeaguesSettings[] = [];
  leagueSearchQuery = '';
  teams: shortTeam[] = [];
  filteredTeams: shortTeam[] = [];
  displayTeams1: shortTeam[] = [];
  displayTeams2: shortTeam[] = [];
  teamSearchQuery1 = '';
  teamSearchQuery2 = '';
  private readonly autocompleteDisplayLimit = 50;
  seasons: SeasonInfo[] = [];
  displaySeasons: SeasonInfo[] = [];
  seasonSearchQuery = '';
  
  // Right column - Viewed matches
  viewedMatches: Match[] = [];
  filteredViewedMatches: Match[] = [];
  pagedViewedMatches: Match[] = [];
  readonly matchesPerPage = 20;
  
  // Filters
  selectedLeague: LeaguesSettings | null = null;
  selectedTeam_1: shortTeam | null = null;
  selectedTeam_2: shortTeam | null = null;
  selectedSeason: SeasonInfo | null = null;
  
  // Loading states
  loadingAvailableRealMatches = false;
  loadingViewedMatches = false;
  readonly skeletonMatchSlots = [1, 2, 3, 4, 5, 6, 7, 8];
  
  constructor(
    private megagoal: MegaGoalService,
    private matchParser: MatchParserService,
    private imagesService: ImagesService
  ) {
    this.init();
  }

  ngOnInit(): void {
    // Log page visit after initial data is loaded
    this.megagoal.logPageVisit('locations').subscribe({
      next: () => {},
      error: (error) => console.error('Error logging page visit:', error)
    });
  }

  init(): void {
    this.locations = [];
    this.loadViewedMatches();
    this.getLocationsCounts(true);
    this.loadLeagues();
    this.loadTeams();
  }

  getLocationsCounts(refresh: boolean = false) {
    this.megagoal.getLocationsCounts().subscribe(result => {
      this.locations = <Location[]>result;
      this.locations.sort((a, b) => a.matchCount > b.matchCount ? -1 : 1);
      if (this.pendingSelectLocationId) {
        const createdId = this.pendingSelectLocationId;
        this.pendingSelectLocationId = null;
        this.selectedLocation = this.locations.find(loc => loc.id === createdId) || null;
        this.locationNameDraft = this.selectedLocation?.name ?? '';
        this.prepareMapForSelection();
        this.onLocationChange();
        return;
      }
      if (this.selectedLocation) {
        this.selectedLocation = this.locations.find(loc => loc.id === this.selectedLocation!.id) || null;
        if (refresh) {
          this.onLocationChange();
        }
      }
    })
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.deleteLocationOpen && !this.deletingLocation) {
      this.closeDeleteLocation();
      return;
    }
    if (this.newLocationOpen && !this.savingLocation) {
      this.closeNewLocation();
    }
  }

  openNewLocation(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.newLocationError = '';
    this.newLocationOpen = true;
  }

  closeNewLocation(): void {
    if (this.savingLocation) {
      return;
    }
    this.newLocationOpen = false;
    this.newLocationError = '';
  }

  saveNewLocation(draft: NewLocationDraft): void {
    const name = draft.name.trim();
    if (!name || this.savingLocation) {
      return;
    }
    const existing = this.locations.find(loc =>
      !loc.stadium && loc.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      this.selectedLocation = existing;
      this.locationNameDraft = existing.name;
      this.prepareMapForSelection();
      this.onLocationChange();
      this.newLocationOpen = false;
      return;
    }
    const place = draft.place;
    this.savingLocation = true;
    this.newLocationError = '';
    this.megagoal.createLocation({ name }).subscribe({
      next: (created) => {
        const finish = () => {
          this.savingLocation = false;
          this.newLocationOpen = false;
          this.pendingSelectLocationId = created.id;
          this.getLocationsCounts(true);
        };
        if (!place) {
          finish();
          return;
        }
        this.megagoal.setLocationPlace(created.id, place).subscribe({
          next: () => finish(),
          error: () => {
            this.placeError = 'Could not save the map position.';
            finish();
          }
        });
      },
      error: () => {
        this.savingLocation = false;
        this.newLocationError = 'Could not save that location.';
      }
    });
  }

  private randomStadiumPin(): { lat: number; lng: number } {
    const stadium = DEFAULT_MAP_STADIUMS[Math.floor(Math.random() * DEFAULT_MAP_STADIUMS.length)];
    return { lat: stadium.lat, lng: stadium.lng };
  }

  get displayLocations(): Location[] {
    const q = this.normalizeSearchText(this.locationSearchQuery);
    const compactQuery = q.replace(/ /g, '');

    return this.locations.filter(location => {
      if (this.locationListFilter === 'map' && !location.place) {
        return false;
      }
      if (this.locationListFilter === 'stadium' && !location.stadium) {
        return false;
      }
      if (!q) {
        return true;
      }
      const name = this.normalizeSearchText(location.name);
      return name.includes(q) || name.replace(/ /g, '').includes(compactQuery);
    });
  }

  toggleLocationFilter(filter: 'map' | 'stadium'): void {
    this.locationListFilter = this.locationListFilter === filter ? 'all' : filter;
  }

  clearLocationSearch(): void {
    this.locationSearchQuery = '';
  }

  clearPlaceSearch(): void {
    if (this.placeSearchTimer) {
      clearTimeout(this.placeSearchTimer);
      this.placeSearchTimer = null;
    }
    this.placeSearchSerial++;
    this.placeQuery = '';
    this.placeResults = [];
    this.searchingPlaces = false;
  }

  @HostListener('document:pointerdown', ['$event'])
  dismissPlaceResults(event: PointerEvent): void {
    if (!this.placeResults.length) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && target.closest('.location-place-search')) {
      return;
    }
    this.placeResults = [];
    this.searchingPlaces = false;
    this.placeSearchSerial++;
  }

  private normalizeSearchText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/['’`´._-]+/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  isLocationSelected(location: Location): boolean {
    return this.selectedLocation?.id === location.id;
  }

  selectLocation(location: Location): void {
    this.resetPlaceEditor();
    this.selectedLocation = this.isLocationSelected(location) ? null : location;
    this.locationNameDraft = this.selectedLocation?.name ?? '';
    this.prepareMapForSelection();
    this.onLocationChange();
  }

  get overviewPins(): LocationMapPin[] {
    const pins = this.locations
      .filter(location => !!location.place)
      .map(location => ({
        id: location.id,
        name: location.name,
        lat: location.place!.lat,
        lng: location.place!.lng,
        matchCount: location.matchCount || 0
      }));
    const key = pins.map(pin => `${pin.id}:${pin.lat},${pin.lng}:${pin.name}:${pin.matchCount}`).join('|');
    if (key === this.overviewPinsCache.key) {
      return this.overviewPinsCache.pins;
    }
    this.overviewPinsCache = { key, pins };
    return pins;
  }

  openOverviewPin(locationId: string): void {
    const location = this.locations.find(item => item.id === locationId);
    if (location) {
      this.selectLocation(location);
    }
  }

  clearLocationSelection(): void {
    this.resetPlaceEditor();
    this.selectedLocation = null;
    this.locationNameDraft = '';
    this.prepareMapForSelection();
    this.onLocationChange();
  }

  get canEditPlace(): boolean {
    return !!this.selectedLocation && !this.selectedLocation.stadium && !this.savingPlace;
  }

  get canSaveLocationName(): boolean {
    if (!this.selectedLocation || this.selectedLocation.stadium || this.savingLocationName) {
      return false;
    }
    const name = this.locationNameDraft.trim();
    return !!name && name !== this.selectedLocation.name;
  }

  get placeSummaryTitle(): string {
    if (this.selectedLocation?.place?.osmName) {
      return this.selectedLocation.place.osmName;
    }
    if (this.selectedLocation?.stadium) {
      return this.stadiumView?.title || this.selectedLocation.name;
    }
    return '';
  }

  get placeSummaryAddress(): string {
    if (this.selectedLocation?.place?.formattedAddress) {
      return this.selectedLocation.place.formattedAddress;
    }
    if (this.selectedLocation?.stadium) {
      return this.stadiumView?.address || '';
    }
    return '';
  }

  get mapMarker(): { lat: number; lng: number } | null {
    if (!this.selectedLocation) {
      return null;
    }
    if (this.draftPin && !this.selectedLocation.stadium) {
      return this.draftPin;
    }
    if (this.selectedLocation.place) {
      return { lat: this.selectedLocation.place.lat, lng: this.selectedLocation.place.lng };
    }
    if (this.selectedLocation.stadium && this.stadiumView) {
      return { lat: this.stadiumView.lat, lng: this.stadiumView.lng };
    }
    return this.previewPin;
  }

  private prepareMapForSelection(): void {
    const locationId = this.selectedLocation?.id ?? null;
    if (locationId === this.mapSelectionId) {
      return;
    }
    this.mapSelectionId = locationId;
    this.previewPin = null;
    this.stadiumView = null;
    const location = this.selectedLocation;
    if (!location) {
      return;
    }
    if (location.stadium) {
      this.resolveStadiumPin(location);
      return;
    }
    if (location.place) {
      rememberMapPin(location.place);
      return;
    }
    this.previewPin = this.randomStadiumPin();
  }

  private resolveStadiumPin(location: Location): void {
    const locationName = this.normalizeSearchText(location.name);
    const known = DEFAULT_MAP_STADIUMS.find(stadium => locationName.includes(this.normalizeSearchText(stadium.name)));
    if (known) {
      this.stadiumView = { lat: known.lat, lng: known.lng, title: location.name, address: known.name };
      return;
    }
    this.megagoal.searchLocationPlaces(location.name).subscribe({
      next: (results) => {
        if (this.selectedLocation?.id !== location.id) {
          return;
        }
        const first = results[0];
        if (!first) {
          return;
        }
        this.stadiumView = {
          lat: first.lat,
          lng: first.lng,
          title: location.name,
          address: first.formattedAddress || first.name
        };
      },
      error: () => {}
    });
  }

  private placeSearchBias(): { lat: number; lng: number } | null {
    if (this.draftPin) {
      return this.draftPin;
    }
    const place = this.selectedLocation?.place;
    if (place) {
      return { lat: place.lat, lng: place.lng };
    }
    return lastMapPin();
  }

  onPlaceQueryChange(value: string): void {
    this.placeQuery = value;
    this.placeError = '';
    if (this.placeSearchTimer) {
      clearTimeout(this.placeSearchTimer);
    }
    const serial = ++this.placeSearchSerial;
    const query = value.trim();
    if (!this.canEditPlace || query.length < 2) {
      this.placeResults = [];
      this.searchingPlaces = false;
      return;
    }
    this.placeSearchTimer = setTimeout(() => {
      if (serial !== this.placeSearchSerial) {
        return;
      }
      this.searchingPlaces = true;
      this.megagoal.searchLocationPlaces(query, this.placeSearchBias()).subscribe({
        next: (results) => {
          if (serial !== this.placeSearchSerial) {
            return;
          }
          this.placeResults = results;
          this.searchingPlaces = false;
        },
        error: () => {
          if (serial !== this.placeSearchSerial) {
            return;
          }
          this.placeResults = [];
          this.searchingPlaces = false;
          this.placeError = 'Place search is unavailable.';
        }
      });
    }, 300);
  }

  choosePlaceResult(result: LocationPlaceResult): void {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.placeQuery = '';
    this.placeResults = [];
    this.placeSearchSerial++;
    this.draftPin = { lat: result.lat, lng: result.lng };
    rememberMapPin(this.draftPin);
    this.savePlace({
      provider: 'osm',
      lat: result.lat,
      lng: result.lng,
      osmId: result.osmId,
      osmType: result.osmType,
      osmName: result.name,
      ...(result.formattedAddress ? { formattedAddress: result.formattedAddress } : {})
    });
  }

  onPinPicked(pin: { lat: number; lng: number }): void {
    this.draftPin = pin;
    rememberMapPin(pin);
    this.savePlace({
      provider: 'osm',
      lat: pin.lat,
      lng: pin.lng
    });
  }

  clearPlace(): void {
    this.draftPin = null;
    this.savePlace(null);
  }

  askDeleteLocation(): void {
    if (!this.selectedLocation || this.selectedLocation.stadium || this.deletingLocation) {
      return;
    }
    this.deleteLocationError = '';
    this.deleteLocationOpen = true;
  }

  closeDeleteLocation(): void {
    if (this.deletingLocation) {
      return;
    }
    this.deleteLocationOpen = false;
    this.deleteLocationError = '';
  }

  confirmDeleteLocation(): void {
    if (!this.selectedLocation || this.selectedLocation.stadium || this.deletingLocation) {
      return;
    }
    const locationId = this.selectedLocation.id;
    this.deletingLocation = true;
    this.deleteLocationError = '';
    this.megagoal.deleteLocation(locationId).subscribe({
      next: () => {
        this.deletingLocation = false;
        this.deleteLocationOpen = false;
        this.locations = this.locations.filter(location => location.id !== locationId);
        this.viewedMatches.forEach(match => {
          if (match.location === locationId) {
            match.location = '';
          }
        });
        this.clearLocationSelection();
        this.getLocationsCounts(false);
      },
      error: () => {
        this.deletingLocation = false;
        this.deleteLocationError = 'Could not delete that location.';
      }
    });
  }

  saveLocationName(): void {
    if (!this.selectedLocation || this.selectedLocation.stadium || this.savingLocationName) {
      return;
    }
    const name = this.locationNameDraft.trim();
    if (!name || name === this.selectedLocation.name) {
      return;
    }
    const locationId = this.selectedLocation.id;
    this.savingLocationName = true;
    this.placeError = '';
    this.megagoal.renameLocation(locationId, name).subscribe({
      next: (updated) => {
        this.savingLocationName = false;
        this.locations = this.locations.map(location =>
          location.id === updated.id ? { ...location, name: updated.name } : location
        );
        if (this.selectedLocation?.id === locationId) {
          this.selectedLocation = this.locations.find(location => location.id === locationId) ?? null;
          this.locationNameDraft = this.selectedLocation?.name ?? updated.name;
        }
      },
      error: () => {
        this.savingLocationName = false;
        if (this.selectedLocation?.id === locationId) {
          this.locationNameDraft = this.selectedLocation.name;
          this.placeError = 'Could not rename that location.';
        }
      }
    });
  }

  private resetPlaceEditor(): void {
    if (this.placeSearchTimer) {
      clearTimeout(this.placeSearchTimer);
      this.placeSearchTimer = null;
    }
    this.placeSearchSerial++;
    this.placeQuery = '';
    this.placeResults = [];
    this.searchingPlaces = false;
    this.placeError = '';
    this.draftPin = null;
  }

  private savePlace(place: LocationPlace | null): void {
    if (!this.selectedLocation || this.selectedLocation.stadium) {
      return;
    }
    const locationId = this.selectedLocation.id;
    this.savingPlace = true;
    this.placeError = '';
    this.megagoal.setLocationPlace(locationId, place).subscribe({
      next: (updated) => {
        this.savingPlace = false;
        if (this.selectedLocation?.id !== locationId) {
          return;
        }
        const nextPlace = updated.place ?? undefined;
        this.locations = this.locations.map(location =>
          location.id === updated.id
            ? { ...location, official: updated.official, stadium: updated.stadium, place: nextPlace }
            : location
        );
        this.selectedLocation = this.locations.find(location => location.id === updated.id) ?? null;
        this.draftPin = null;
        if (!nextPlace && this.selectedLocation && !this.selectedLocation.stadium) {
          const stadium = DEFAULT_MAP_STADIUMS[Math.floor(Math.random() * DEFAULT_MAP_STADIUMS.length)];
          this.previewPin = { lat: stadium.lat, lng: stadium.lng };
        }
      },
      error: () => {
        this.savingPlace = false;
        if (this.selectedLocation?.id === locationId) {
          this.draftPin = null;
          this.placeError = 'Could not save that place.';
        }
      }
    });
  }

  checkRealMatchesByLocation() {
    if (this.selectedLocation?.venue_id) {
      this.filteredRealMatches = this.availableRealMatches.filter(match => match.fixture.venue.id === this.selectedLocation?.venue_id);
    } else {
      this.filteredRealMatches = [...this.availableRealMatches];
    }
    
    // Limit items for performance (virtual scrolling will handle the rest)
    if (this.filteredRealMatches.length > 1000) {
      this.filteredRealMatches = this.filteredRealMatches.slice(0, 1000);
    }
  }

  onLocationChange() {
    if (this.selectedLocation) {
      this.checkRealMatchesByLocation();
      this.filteredViewedMatches = this.viewedMatches.filter(match => match.location === this.selectedLocation!.id);
    } else {
      this.checkRealMatchesByLocation();
      this.filteredViewedMatches = [...this.viewedMatches];
    }
  }

  loadTeams() {
    this.megagoal.getTeamsByTopLeague().subscribe(teams => {
      this.teams = teams.sort((a, b) => a.name.localeCompare(b.name));
      this.filteredTeams = [...this.teams];
      this.updateTeamDisplayLists();
    });
  }

  onLeagueInputChange(): void {
    this.updateLeagueDisplayList();
    const query = this.leagueSearchQuery.trim();

    if (!query) {
      if (this.selectedLeague !== null) {
        this.selectedLeague = null;
        this.applyFilters();
      }
      return;
    }

    if (this.selectedLeague && query !== this.selectedLeague.league_name) {
      this.selectedLeague = null;
      this.applyFilters();
    }
  }

  onSeasonInputChange(): void {
    this.updateSeasonDisplayList();
    const query = this.seasonSearchQuery.trim();

    if (!query) {
      if (this.selectedSeason !== null) {
        this.selectedSeason = null;
        this.applyFilters();
      }
      return;
    }

    if (this.selectedSeason && query !== this.selectedSeason.text) {
      this.selectedSeason = null;
      this.applyFilters();
    }
  }

  onLeagueSelected(event: MatAutocompleteSelectedEvent): void {
    const value = event.option.value as LeaguesSettings | null;
    this.selectedLeague = value;
    this.leagueSearchQuery = value?.league_name ?? '';
    this.updateLeagueDisplayList();
    this.applyFilters();
  }

  onSeasonSelected(event: MatAutocompleteSelectedEvent): void {
    const value = event.option.value as SeasonInfo | null;
    this.selectedSeason = value;
    this.seasonSearchQuery = value?.text ?? '';
    this.updateSeasonDisplayList();
    this.applyFilters();
  }

  onTeam1InputChange(): void {
    this.updateTeamDisplayLists();
    const query = this.teamSearchQuery1.trim();

    if (!query) {
      if (this.selectedTeam_1 !== null) {
        this.selectedTeam_1 = null;
        this.applyFilters();
      }
      return;
    }

    if (this.selectedTeam_1 && query !== this.selectedTeam_1.name) {
      this.selectedTeam_1 = null;
      this.applyFilters();
    }
  }

  onTeam2InputChange(): void {
    this.updateTeamDisplayLists();
    const query = this.teamSearchQuery2.trim();

    if (!query) {
      if (this.selectedTeam_2 !== null) {
        this.selectedTeam_2 = null;
        this.applyFilters();
      }
      return;
    }

    if (this.selectedTeam_2 && query !== this.selectedTeam_2.name) {
      this.selectedTeam_2 = null;
      this.applyFilters();
    }
  }

  onTeam1Selected(event: MatAutocompleteSelectedEvent): void {
    const value = event.option.value as shortTeam | null;
    this.selectedTeam_1 = value;
    this.teamSearchQuery1 = value?.name ?? '';
    this.updateTeamDisplayLists();
    this.applyFilters();
  }

  onTeam2Selected(event: MatAutocompleteSelectedEvent): void {
    const value = event.option.value as shortTeam | null;
    this.selectedTeam_2 = value;
    this.teamSearchQuery2 = value?.name ?? '';
    this.updateTeamDisplayLists();
    this.applyFilters();
  }

  private updateLeagueDisplayList(): void {
    this.displayLeagues = this.buildLeagueDisplayList(this.leagueSearchQuery, this.selectedLeague);
  }

  private updateSeasonDisplayList(): void {
    this.displaySeasons = this.buildSeasonDisplayList(this.seasonSearchQuery, this.selectedSeason);
  }

  private updateTeamDisplayLists(): void {
    this.displayTeams1 = this.buildTeamDisplayList(this.teamSearchQuery1, this.selectedTeam_1);
    this.displayTeams2 = this.buildTeamDisplayList(this.teamSearchQuery2, this.selectedTeam_2);
  }

  private buildLeagueDisplayList(searchQuery: string, selected: LeaguesSettings | null): LeaguesSettings[] {
    const pool = this.getLeaguesMatchingSearch(searchQuery);
    const visible = pool.slice(0, this.autocompleteDisplayLimit);
    const selectedExtra = selected && !visible.some(l => l.league_id === selected.league_id) ? [selected] : [];

    return [...selectedExtra, ...visible].sort((a, b) => a.league_name.localeCompare(b.league_name));
  }

  private buildSeasonDisplayList(searchQuery: string, selected: SeasonInfo | null): SeasonInfo[] {
    const pool = this.getSeasonsMatchingSearch(searchQuery);
    const visible = pool.slice(0, this.autocompleteDisplayLimit);
    const selectedExtra = selected && !visible.some(s => s.id === selected.id) ? [selected] : [];

    return [...selectedExtra, ...visible].sort((a, b) => b.id - a.id);
  }

  private buildTeamDisplayList(searchQuery: string, selected: shortTeam | null): shortTeam[] {
    const pool = this.getTeamsMatchingSearch(searchQuery);
    const visible = pool.slice(0, this.autocompleteDisplayLimit);
    const selectedExtra = selected && !visible.some(t => t.id === selected.id) ? [selected] : [];

    return [...selectedExtra, ...visible].sort((a, b) => a.name.localeCompare(b.name));
  }

  private getLeaguesMatchingSearch(searchQuery: string): LeaguesSettings[] {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return [...this.leagues];
    }

    return this.leagues.filter(league => league.league_name.toLowerCase().includes(q));
  }

  private getSeasonsMatchingSearch(searchQuery: string): SeasonInfo[] {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return [...this.seasons];
    }

    return this.seasons.filter(season => season.text.toLowerCase().includes(q));
  }

  private getTeamsMatchingSearch(searchQuery: string): shortTeam[] {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return [...this.filteredTeams];
    }

    return this.filteredTeams.filter(team => team.name.toLowerCase().includes(q));
  }

  get matchingLeagueCount(): number {
    return this.getLeaguesMatchingSearch(this.leagueSearchQuery).length;
  }

  get matchingSeasonCount(): number {
    return this.getSeasonsMatchingSearch(this.seasonSearchQuery).length;
  }

  get hasMoreLeaguesThanDisplayed(): boolean {
    return this.matchingLeagueCount > this.displayLeagues.length;
  }

  get hasMoreSeasonsThanDisplayed(): boolean {
    return this.matchingSeasonCount > this.displaySeasons.length;
  }

  get matchingTeamCount1(): number {
    return this.getTeamsMatchingSearch(this.teamSearchQuery1).length;
  }

  get matchingTeamCount2(): number {
    return this.getTeamsMatchingSearch(this.teamSearchQuery2).length;
  }

  get hasMoreTeamsThanDisplayed1(): boolean {
    return this.matchingTeamCount1 > this.displayTeams1.length;
  }

  get hasMoreTeamsThanDisplayed2(): boolean {
    return this.matchingTeamCount2 > this.displayTeams2.length;
  }

  loadLeagues() {
    this.megagoal.getLeaguesSettings().subscribe(leagues => {
      this.leagues = leagues.sort((a, b) => a.league_name.localeCompare(b.league_name));
      this.loadSeasons();
      this.updateLeagueDisplayList();
    });
  }

  loadSeasons() {
    // Generate seasons from available_seasons in leagues settings
    const seasonSet = new Set<number>();
    this.seasons = [];
    this.leagues.forEach(league => {
      if (league.available_seasons) {
        league.available_seasons.forEach(seasonInfo => {
          // Only include seasons with real_matches and teams greater than 0
          if (seasonInfo.real_matches > 0 && seasonInfo.teams > 0) {
            seasonSet.add(seasonInfo.season);
          }
        });
      }
    });
    
    // Convert Set to Array, create SeasonInfo objects, and sort in descending order (newest first)
    this.seasons = Array.from(seasonSet)
      .sort((a, b) => b - a)
      .map(year => ({
        id: year,
        text: `${year}-${year + 1}`
      }));

    this.updateSeasonDisplayList();
  }

  loadAvailableRealMatches(league_id?: number, season?: number, team_1_id?: number, team_2_id?: number) {    
    this.loadingAvailableRealMatches = true;
    
    // Build parameters object with only defined values
    const parameters: { [key: string]: any } = {};
    
    if (league_id) parameters['league_id'] = league_id;
    if (season) parameters['season'] = season;
    if (team_1_id) parameters['team_id'] = team_1_id;
    if (team_2_id) parameters['team_2_id'] = team_2_id;
    
    // Add finished parameter to get only completed matches
    parameters['finished'] = 'true';
    
    this.megagoal.getRealMatchesByParameters(parameters).subscribe({
      next: (matches: RealMatch[]) => {
        // Sort matches by date (most recent first)
        this.availableRealMatches = matches.sort((a, b) => 
          new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime()
        );
        this.loadingAvailableRealMatches = false;
        this.checkRealMatchesByLocation();
      },
      error: (error: any) => {
        console.error('Error loading available matches:', error);
        this.loadingAvailableRealMatches = false;
      }
    });
  }

  loadViewedMatches() {
    this.loadingViewedMatches = true;
    // Load matches for the selected location
    this.megagoal.getMatches().subscribe(matches => {
      // Sort matches by date (most recent first)
      this.viewedMatches = matches.sort((a, b) => 
        (b.fixture.timestamp * 1000) - (a.fixture.timestamp * 1000)
      );
      this.loadingViewedMatches = false;
      this.filteredViewedMatches = [...this.viewedMatches];
      this.onLocationChange();
    });
  }

  getSelectedFilters() {
    return [
      this.selectedLeague,
      this.selectedSeason,
      this.selectedTeam_1,
      this.selectedTeam_2
    ].filter(filter => filter !== null);
  }

  applyFilters() {
    // Filter teams based on league and season
    this.filterTeamsByLeagueAndSeason();
    
    // Count how many filters are selected
    const selectedFilters = this.getSelectedFilters();
    
    // Call loadAvailableRealMatches if at least 2 filters are selected
    if (selectedFilters.length >= 2) {
      
      this.loadAvailableRealMatches(
        this.selectedLeague?.league_id || undefined,
        this.selectedSeason?.id || undefined,
        this.selectedTeam_1?.id || undefined,
        this.selectedTeam_2?.id || undefined
      );
    } else {
      this.availableRealMatches = [];
      this.filteredRealMatches = [];
      this.loadingAvailableRealMatches = false;
    }
  }

  filterTeamsByLeagueAndSeason() {
    if (!this.selectedLeague && !this.selectedSeason) {
      // If no league and no season selected, show all teams
      this.filteredTeams = [...this.teams];
      this.updateTeamDisplayLists();
      return;
    }

    // Filter teams based on their seasons array
    this.filteredTeams = this.teams.filter(team => {
      // Check if the team has seasons data
      if (!team.seasons || team.seasons.length === 0) {
        return false;
      }

      // Check if the team matches the selected filters
      return team.seasons.some(season => {
        let leagueMatches = true;
        let seasonMatches = true;

        // Check league filter if selected
        if (this.selectedLeague) {
          leagueMatches = season.league === this.selectedLeague.league_id.toString();
        }

        // Check season filter if selected
        if (this.selectedSeason) {
          seasonMatches = season.season === this.selectedSeason.id.toString();
        }

        // Return true if both conditions are met (when both filters are applied)
        // or if the single filter condition is met (when only one filter is applied)
        return leagueMatches && seasonMatches;
      });
    });

    // Reset team selections if they're no longer in the filtered list
    if (this.selectedTeam_1 && !this.filteredTeams.find(t => t.id === this.selectedTeam_1!.id)) {
      this.selectedTeam_1 = null;
      this.teamSearchQuery1 = '';
    }
    if (this.selectedTeam_2 && !this.filteredTeams.find(t => t.id === this.selectedTeam_2!.id)) {
      this.selectedTeam_2 = null;
      this.teamSearchQuery2 = '';
    }
    
    // Reset rival team if main team is unselected
    if (!this.selectedTeam_1) {
      this.selectedTeam_2 = null;
      this.teamSearchQuery2 = '';
    }

    this.updateTeamDisplayLists();
  }

  addMatchWithLocation(realMatch: RealMatch, locationId: string | number) {
    if (!locationId) return;

    if (this.viewedMatches.find(match => match.fixture.id === realMatch.fixture.id)) {
      this.setLocation(realMatch.fixture.id, locationId);
      return;
    }

    let refresh = true;

    const alreadyLocation = this.locations.find(loc => loc.id === locationId || loc.venue_id === locationId);
    if (alreadyLocation) {
      locationId = alreadyLocation.id;
      refresh = false;
    }

    const matchRequest = this.matchParser.realMatchToMatch(realMatch);
    matchRequest.location = locationId.toString();
    
    this.viewedMatches.push(matchRequest);
    this.viewedMatches = this.viewedMatches.sort((a, b) => 
      (b.fixture.timestamp * 1000) - (a.fixture.timestamp * 1000)
    );
    this.filteredViewedMatches = this.viewedMatches.filter(match => 
      !this.selectedLocation || match.location === this.selectedLocation.id
    );
    
    this.megagoal.createMatch(this.matchParser.matchToMatchRequest(matchRequest)).subscribe(() => {
      if (refresh) {
        this.loadViewedMatches();
      }
      this.getLocationsCounts(refresh);
    });
  }

  deleteMatch(match: Match) {
    this.viewedMatches = this.viewedMatches.filter(m => m.fixture.id !== match.fixture.id);
    this.filteredViewedMatches = this.viewedMatches.filter(match => 
      !this.selectedLocation || match.location === this.selectedLocation.id
    );
    
    this.megagoal.deleteMatch(match.fixture.id).subscribe(() => {
      this.getLocationsCounts(false);
    });
  }

  setLocation(fixtureId: number, location: string | number) {
    const alreadyLocation = this.locations.find(loc => loc.id === location || loc.venue_id === location);
    if (alreadyLocation) {
      location = alreadyLocation.id;
    }
    this.viewedMatches.forEach(match => {
      if (match.fixture.id === fixtureId) {
        match.location = location.toString();
        this.filteredViewedMatches = this.viewedMatches.filter(match => 
          !this.selectedLocation || match.location === this.selectedLocation.id
        );
      }
    });
    
    this.megagoal.setLocation(fixtureId, location.toString()).subscribe(() => {
      this.getLocationsCounts(false);
     });
  }

  clearFilters() {
    this.selectedLeague = null;
    this.selectedTeam_1 = null;
    this.selectedTeam_2 = null;
    this.selectedSeason = null;
    this.leagueSearchQuery = '';
    this.seasonSearchQuery = '';
    this.teamSearchQuery1 = '';
    this.teamSearchQuery2 = '';
    this.filteredTeams = [...this.teams];
    this.updateLeagueDisplayList();
    this.updateSeasonDisplayList();
    this.updateTeamDisplayLists();
    this.applyFilters();
  }

  isMatchAlreadyViewed(realMatch: RealMatch): boolean {
    // Check if this real match exists in any viewed matches
    return this.viewedMatches.some(viewedMatch => 
      viewedMatch.fixture.id === realMatch.fixture.id
    );
  }

  isMatchViewedAtSelectedLocation(realMatch: RealMatch): boolean {
    // Check if this real match is viewed at the currently selected location
    if (!this.selectedLocation) return false;

    const match = this.viewedMatches.find(viewedMatch => 
      viewedMatch.fixture.id === realMatch.fixture.id && 
      viewedMatch.location === this.selectedLocation?.id
    );

    return match !== undefined ? true : false;
  }

  isRealMatchViewedAtStadiumLocation(realMatch: RealMatch): boolean {
    // Check if this real match is viewed at any stadium location
    const match = this.viewedMatches.find(viewedMatch => 
      viewedMatch.fixture.id === realMatch.fixture.id
    );

    if (!match) return false;

    // Find the location where this match is viewed
    const location = this.locations.find(loc => loc.id === match.location);
    
    // Return true if the location is a stadium
    return location?.stadium === true;
  }

  isMatchViewedAtStadiumLocation(match: Match): boolean {
    // Find the location where this match is viewed
    const location = this.locations.find(loc => loc.id === match.location);
    
    // Return true if the location is a stadium
    return location?.stadium === true;
  }

  // Helper method to get team image URL
  getTeamImageUrl(teamId: number): string {
    const baseUrl = this.imagesService.getRouteImageTeam(teamId);
    return `${baseUrl}?size=24x24`;
  }

  // Helper method to format match result for RealMatch
  getMatchResult(realMatch: RealMatch): string {
    if (realMatch.score && realMatch.score.fulltime && realMatch.score.fulltime.home !== null && realMatch.score.fulltime.away !== null) {
      return `${realMatch.score.fulltime.home} - ${realMatch.score.fulltime.away}`;
    }
    return 'TBD';
  }

  // Helper method to format match result for Match
  getMatchResultFromMatch(match: Match): string {
    if (match.goals && match.goals.home !== null && match.goals.away !== null) {
      return `${match.goals.home} - ${match.goals.away}`;
    }
    return 'TBD';
  }

  // Helper method to get tooltip for real matches
  getMatchLocationTooltip(realMatch: RealMatch): string {
    const match = this.viewedMatches.find(viewedMatch => 
      viewedMatch.fixture.id === realMatch.fixture.id
    );

    if (!match) {
      return '';
    }

    const location = this.locations.find(loc => loc.id === match.location);
    if (location) {
      return `Viewed at: ${location.name}`;
    }

    return `Viewed at: Empty`;
  }

  // Helper method to get tooltip for viewed matches
  getViewedMatchLocationTooltip(match: Match): string {
    const location = this.locations.find(loc => loc.id === match.location);
    if (location) {
      return `Viewed at: ${location.name}`;
    }

    return `Viewed at: Empty`;
  }
}
