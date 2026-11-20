import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LocationMapComponent } from '../../locations/location-map/location-map.component';
import { MegaGoalService } from '../../../services/megagoal.service';
import { Venue, VenuePlace } from '../../../models/venue';
import { LocationPlaceResult } from '../../../models/location';

@Component({
  selector: 'app-admin-venue',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LocationMapComponent],
  templateUrl: './admin-venue.component.html',
  styleUrl: './admin-venue.component.css'
})
export class AdminVenueComponent implements OnInit, OnDestroy {
  venue: Venue | null = null;
  draftPlace: VenuePlace | null = null;
  loading = true;
  saving = false;
  error: string | null = null;
  placeQuery = '';
  placeResults: LocationPlaceResult[] = [];
  searchingPlaces = false;
  private placeSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private placeSearchSerial = 0;

  constructor(
    private route: ActivatedRoute,
    private megaGoal: MegaGoalService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(id)) {
      this.loading = false;
      this.error = 'Venue not found.';
      return;
    }
    this.megaGoal.getVenue(id).subscribe({
      next: (venue) => {
        this.venue = venue;
        this.draftPlace = venue.place ? { ...venue.place } : null;
        this.loading = false;
      },
      error: () => {
        this.venue = null;
        this.loading = false;
        this.error = 'Venue not found.';
      }
    });
  }

  ngOnDestroy(): void {
    if (this.placeSearchTimer) {
      clearTimeout(this.placeSearchTimer);
    }
  }

  get pinned(): boolean {
    return typeof this.venue?.place?.lat === 'number' && typeof this.venue?.place?.lng === 'number';
  }

  get mapMarker(): { lat: number; lng: number } | null {
    const place = this.draftPlace ?? this.venue?.place;
    if (typeof place?.lat !== 'number' || typeof place?.lng !== 'number') {
      return null;
    }
    return { lat: place.lat, lng: place.lng };
  }

  get canSave(): boolean {
    return !!this.draftPlace && !this.saving && !this.samePlace(this.draftPlace, this.venue?.place);
  }

  get backQuery(): { view: string; country?: string } {
    const country = this.venue?.country?.trim();
    return country ? { view: 'venues', country } : { view: 'venues' };
  }

  onPlaceQueryChange(value: string): void {
    this.placeQuery = value;
    this.error = null;
    if (this.placeSearchTimer) {
      clearTimeout(this.placeSearchTimer);
    }
    const serial = ++this.placeSearchSerial;
    const query = value.trim();
    if (query.length < 2) {
      this.placeResults = [];
      this.searchingPlaces = false;
      return;
    }
    this.placeSearchTimer = setTimeout(() => {
      if (serial !== this.placeSearchSerial) {
        return;
      }
      this.searchingPlaces = true;
      const bias = this.mapMarker;
      this.megaGoal.searchLocationPlaces(query, bias).subscribe({
        next: (results) => {
          if (serial !== this.placeSearchSerial) {
            return;
          }
          this.placeResults = results || [];
          this.searchingPlaces = false;
        },
        error: () => {
          if (serial !== this.placeSearchSerial) {
            return;
          }
          this.placeResults = [];
          this.searchingPlaces = false;
          this.error = 'Place search is unavailable.';
        }
      });
    }, 300);
  }

  choosePlaceResult(result: LocationPlaceResult): void {
    const place: VenuePlace = {
      provider: 'osm',
      lat: result.lat,
      lng: result.lng,
      osmId: result.osmId,
      osmType: result.osmType,
      osmName: result.name
    };
    if (result.formattedAddress) {
      place.formattedAddress = result.formattedAddress;
    }
    this.placeQuery = '';
    this.placeResults = [];
    this.placeSearchSerial++;
    this.draftPlace = place;
  }

  onPinPicked(pin: { lat: number; lng: number }): void {
    this.draftPlace = {
      provider: 'osm',
      lat: pin.lat,
      lng: pin.lng
    };
  }

  savePlace(): void {
    if (!this.venue || !this.draftPlace || !this.canSave) {
      return;
    }
    const place = this.draftPlace;
    this.saving = true;
    this.error = null;
    this.megaGoal.setVenuePlace(this.venue.id, place).subscribe({
      next: (result) => {
        if (this.venue) {
          this.venue = { ...this.venue, place: result.place };
          this.draftPlace = { ...result.place };
        }
        this.saving = false;
      },
      error: () => {
        this.error = 'Could not save the pin.';
        this.saving = false;
      }
    });
  }

  private samePlace(draft: VenuePlace, saved?: VenuePlace): boolean {
    if (!saved) {
      return false;
    }
    return draft.lat === saved.lat
      && draft.lng === saved.lng
      && draft.osmId === saved.osmId
      && draft.osmType === saved.osmType
      && draft.osmName === saved.osmName
      && draft.formattedAddress === saved.formattedAddress;
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
    if (target instanceof Element && target.closest('.venue-place-search')) {
      return;
    }
    this.placeResults = [];
  }

}
