import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MegaGoalService } from '../../../services/megagoal.service';
import { UpdaterService } from '../../../services/updater.service';
import { Venue, VenueCountry } from '../../../models/venue';

@Component({
  selector: 'app-admin-venues',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-venues.component.html',
  styleUrl: './admin-venues.component.css'
})
export class AdminVenuesComponent implements OnInit {
  countries: VenueCountry[] = [];
  venues: Venue[] = [];
  countrySearch = '';
  venueSearch = '';
  selectedCountry: VenueCountry | null = null;
  loadingCountries = false;
  loadingVenues = false;
  updating = false;
  error: string | null = null;
  updateMessage: string | null = null;

  constructor(
    private megaGoalService: MegaGoalService,
    private updaterService: UpdaterService
  ) {}

  ngOnInit(): void {
    this.loadCountries();
  }

  get filteredCountries(): VenueCountry[] {
    const query = this.countrySearch.trim().toLowerCase();
    if (!query) {
      return this.countries;
    }
    return this.countries.filter(country => country.name.toLowerCase().includes(query));
  }

  get filteredVenues(): Venue[] {
    const query = this.normalizeSearchText(this.venueSearch);
    if (!query) {
      return this.venues;
    }
    const compactQuery = query.replace(/ /g, '');
    return this.venues.filter(venue => {
      const haystack = this.normalizeSearchText([venue.name, venue.city, venue.address].filter(Boolean).join(' '));
      return haystack.includes(query) || haystack.replace(/ /g, '').includes(compactQuery);
    });
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
        this.countries = countries || [];
        if (this.selectedCountry) {
          const refreshed = this.countries.find(country => country.name === this.selectedCountry?.name);
          if (refreshed) {
            this.selectedCountry = refreshed;
          }
        }
        this.loadingCountries = false;
      },
      error: () => {
        this.error = 'Could not load countries.';
        this.loadingCountries = false;
      }
    });
  }

  openCountry(country: VenueCountry): void {
    this.selectedCountry = country;
    this.venueSearch = '';
    this.updateMessage = null;
    this.error = null;
    this.loadVenues();
  }

  backToCountries(): void {
    this.selectedCountry = null;
    this.venues = [];
    this.venueSearch = '';
    this.updateMessage = null;
    this.error = null;
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

  formatCapacity(capacity: number | null): string {
    if (capacity == null) {
      return '—';
    }
    return capacity.toLocaleString('en-US');
  }
}
