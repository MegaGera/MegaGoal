import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MegaGoalService } from '../../../services/megagoal.service';
import { UpdaterService } from '../../../services/updater.service';
import { Venue, VenueCountry } from '../../../models/venue';
import { PaginationComponent } from '../../pagination/pagination.component';

@Component({
  selector: 'app-admin-venues',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent],
  templateUrl: './admin-venues.component.html',
  styleUrl: './admin-venues.component.css'
})
export class AdminVenuesComponent implements OnInit, OnDestroy {
  countries: VenueCountry[] = [];
  venues: Venue[] = [];
  filteredCountries: VenueCountry[] = [];
  filteredVenues: Venue[] = [];
  pagedCountries: VenueCountry[] = [];
  pagedVenues: Venue[] = [];
  readonly pageSize = 20;
  countrySearch = '';
  countrySort: 'name' | 'venues' = 'name';
  withVenuesOnly = true;
  venueSearch = '';
  venueSort: 'name' | 'capacity' = 'name';
  withoutPinOnly = false;
  selectedCountry: VenueCountry | null = null;
  loadingCountries = false;
  loadingVenues = false;
  updating = false;
  placing = false;
  locatingVenueId: number | null = null;
  cleaning = false;
  cleanupMessage: string | null = null;
  error: string | null = null;
  updateMessage: string | null = null;
  private querySub?: Subscription;

  constructor(
    private megaGoalService: MegaGoalService,
    private updaterService: UpdaterService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.querySub = this.route.queryParamMap.subscribe(params => {
      if (params.get('view') !== 'venues') {
        return;
      }
      this.applyCountryParam(params.get('country'));
    });
  }

  ngOnInit(): void {
    this.loadCountries();
  }

  ngOnDestroy(): void {
    this.querySub?.unsubscribe();
  }

  setCountrySort(sort: 'name' | 'venues'): void {
    this.countrySort = sort;
    this.refreshCountryFilter();
  }

  setVenueSort(sort: 'name' | 'capacity'): void {
    this.venueSort = sort;
    this.refreshVenueFilter();
  }

  toggleWithoutPin(): void {
    this.withoutPinOnly = !this.withoutPinOnly;
    this.refreshVenueFilter();
  }

  toggleWithVenues(): void {
    this.withVenuesOnly = !this.withVenuesOnly;
    this.refreshCountryFilter();
  }

  refreshCountryFilter(): void {
    const query = this.countrySearch.trim().toLowerCase();
    const rows = this.countries.filter(country => {
      if (this.withVenuesOnly && country.venueCount <= 0) {
        return false;
      }
      return !query || country.name.toLowerCase().includes(query);
    });
    rows.sort((a, b) => {
      if (this.countrySort === 'venues' && a.venueCount !== b.venueCount) {
        return b.venueCount - a.venueCount;
      }
      return a.name.localeCompare(b.name);
    });
    this.filteredCountries = rows;
    this.pagedCountries = rows.slice(0, this.pageSize);
  }

  refreshVenueFilter(): void {
    const query = this.normalizeSearchText(this.venueSearch);
    if (!query) {
      this.filteredVenues = [...this.venues];
    } else {
      const compactQuery = query.replace(/ /g, '');
      this.filteredVenues = this.venues.filter(venue => {
        const haystack = this.normalizeSearchText([venue.name, venue.city, venue.address].filter(Boolean).join(' '));
        return haystack.includes(query) || haystack.replace(/ /g, '').includes(compactQuery);
      });
    }
    if (this.withoutPinOnly) {
      this.filteredVenues = this.filteredVenues.filter(venue => !this.hasPin(venue));
    }
    this.filteredVenues.sort((a, b) => {
      if (this.venueSort === 'capacity') {
        const capacityDiff = (b.capacity ?? -1) - (a.capacity ?? -1);
        if (capacityDiff !== 0) {
          return capacityDiff;
        }
      }
      return a.name.localeCompare(b.name);
    });
    this.pagedVenues = this.filteredVenues.slice(0, this.pageSize);
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

  loadCountries(): void {
    this.loadingCountries = true;
    this.error = null;
    this.megaGoalService.getVenueCountries().subscribe({
      next: (countries) => {
        this.countries = (countries || []).map(country => ({
          ...country,
          pinnedCount: country.pinnedCount ?? 0
        }));
        if (this.selectedCountry) {
          const refreshed = this.countries.find(country => country.name === this.selectedCountry?.name);
          if (refreshed) {
            this.selectedCountry = refreshed;
          }
        }
        this.refreshCountryFilter();
        this.loadingCountries = false;
      },
      error: () => {
        this.error = 'Could not load countries.';
        this.loadingCountries = false;
      }
    });
  }

  openCountry(country: VenueCountry): void {
    if (this.selectedCountry?.name === country.name) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { country: country.name },
      queryParamsHandling: 'merge',
    });
  }

  backToCountries(): void {
    if (!this.route.snapshot.queryParamMap.get('country')) {
      this.applyCountryParam(null);
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { country: null },
      queryParamsHandling: 'merge',
    });
  }

  private applyCountryParam(raw: string | null): void {
    const name = raw?.trim() || null;
    if (!name) {
      if (!this.selectedCountry) {
        return;
      }
      this.selectedCountry = null;
      this.venues = [];
      this.filteredVenues = [];
      this.pagedVenues = [];
      this.venueSearch = '';
      this.updateMessage = null;
      this.error = null;
      this.refreshCountryFilter();
      return;
    }
    if (this.selectedCountry?.name === name) {
      const known = this.countries.find(country => country.name === name);
      if (known) {
        this.selectedCountry = known;
      }
      return;
    }
    const known = this.countries.find(country => country.name === name);
    this.selectedCountry = known ?? { name, code: null, flag: null, venueCount: 0, pinnedCount: 0 };
    this.venueSearch = '';
    this.filteredVenues = [];
    this.pagedVenues = [];
    this.venues = [];
    this.updateMessage = null;
    this.error = null;
    this.loadVenues();
  }

  loadVenues(): void {
    if (!this.selectedCountry) {
      return;
    }
    this.loadingVenues = true;
    this.error = null;
    this.megaGoalService.getVenuesByCountry(this.selectedCountry.name).subscribe({
      next: (venues) => {
        this.venues = venues || [];
        this.syncCountryCounts();
        this.refreshVenueFilter();
        this.loadingVenues = false;
      },
      error: () => {
        this.error = 'Could not load venues.';
        this.loadingVenues = false;
      }
    });
  }

  updateVenues(): void {
    if (!this.selectedCountry || this.updating) {
      return;
    }
    this.updating = true;
    this.error = null;
    this.updateMessage = null;
    this.updaterService.updateVenues(this.selectedCountry.name).subscribe({
      next: (result) => {
        const inserted = result?.inserted ?? 0;
        const updated = result?.updated ?? 0;
        this.updateMessage = `${inserted} new, ${updated} refreshed.`;
        this.updating = false;
        this.loadVenues();
        this.loadCountries();
      },
      error: () => {
        this.error = 'Could not update venues for this country.';
        this.updating = false;
      }
    });
  }

  cleanupDuplicates(): void {
    if (this.cleaning) {
      return;
    }
    const confirmed = confirm('Remove duplicate venues and keep one row for each stadium id?');
    if (!confirmed) {
      return;
    }
    this.cleaning = true;
    this.cleanupMessage = null;
    this.error = null;
    this.megaGoalService.cleanupDuplicateVenues().subscribe({
      next: (result) => {
        const removed = result?.removed ?? 0;
        this.cleanupMessage = removed === 0
          ? 'No duplicate venues.'
          : `Removed ${removed} duplicate venues.`;
        this.cleaning = false;
        this.loadCountries();
      },
      error: () => {
        this.error = 'Could not remove duplicate venues.';
        this.cleaning = false;
      }
    });
  }

  setMapPins(): void {
    if (!this.selectedCountry || this.placing || this.updating) {
      return;
    }
    this.placing = true;
    this.error = null;
    this.updateMessage = null;
    this.megaGoalService.setVenuePlaces(this.selectedCountry.name).subscribe({
      next: (result) => {
        const placed = result?.placed ?? 0;
        const skipped = result?.skipped ?? 0;
        const notFound = result?.notFound ?? 0;
        const failed = result?.failed ?? 0;
        const parts = [`${placed} pins saved`, `${skipped} already pinned`, `${notFound} not found`];
        if (failed > 0) {
          parts.push(`${failed} failed`);
        }
        this.updateMessage = parts.join('. ') + '.';
        this.placing = false;
        this.loadVenues();
      },
      error: () => {
        this.error = 'Could not set map pins for this country.';
        this.placing = false;
      }
    });
  }

  locateVenue(event: Event, venue: Venue): void {
    event.stopPropagation();
    if (this.locatingVenueId != null) {
      return;
    }
    this.locatingVenueId = venue.id;
    this.error = null;
    this.megaGoalService.searchVenuePlace(venue.id).subscribe({
      next: (result) => {
        venue.place = result.place;
        this.locatingVenueId = null;
        this.syncCountryCounts();
        this.refreshVenueFilter();
      },
      error: () => {
        this.error = 'Could not find a place for this venue.';
        this.locatingVenueId = null;
      }
    });
  }

  openVenue(venue: Venue): void {
    void this.router.navigate(['/app/admin/venues', venue.id]);
  }

  hasPin(venue: Venue): boolean {
    return typeof venue.place?.lat === 'number' && typeof venue.place?.lng === 'number';
  }

  private syncCountryCounts(): void {
    if (!this.selectedCountry) {
      return;
    }
    this.selectedCountry.venueCount = this.venues.length;
    this.selectedCountry.pinnedCount = this.venues.filter(venue => this.hasPin(venue)).length;
  }

  formatCapacity(capacity: number | null): string {
    if (capacity == null) {
      return '—';
    }
    return capacity.toLocaleString('en-US');
  }
}
