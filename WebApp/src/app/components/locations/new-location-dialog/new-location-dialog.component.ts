import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { jamClose, jamSearch } from '@ng-icons/jam-icons';
import { DEFAULT_MAP_STADIUMS, LocationPlace, LocationPlaceResult } from '../../../models/location';
import { MegaGoalService } from '../../../services/megagoal.service';
import { LocationMapComponent } from '../location-map/location-map.component';

export interface NewLocationDraft {
  name: string;
  place: LocationPlace | null;
}

@Component({
  selector: 'app-new-location-dialog',
  standalone: true,
  imports: [FormsModule, NgIconComponent, LocationMapComponent],
  providers: [provideIcons({ jamSearch, jamClose })],
  templateUrl: './new-location-dialog.component.html',
  styleUrl: './new-location-dialog.component.css'
})
export class NewLocationDialogComponent implements AfterViewInit {
  @Input() saving = false;
  @Input() error = '';
  @Output() save = new EventEmitter<NewLocationDraft>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('nameInput') private nameInput?: ElementRef<HTMLInputElement>;

  name = '';
  placeQuery = '';
  placeResults: LocationPlaceResult[] = [];
  searchingPlaces = false;
  placeError = '';
  draftPlace: LocationPlace | null = null;
  previewPin: { lat: number; lng: number } | null = null;
  private searchSerial = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private megagoal: MegaGoalService) {
    this.previewPin = this.randomStadiumPin();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.nameInput?.nativeElement.focus());
  }

  get mapMarker(): { lat: number; lng: number } | null {
    if (this.draftPlace) {
      return { lat: this.draftPlace.lat, lng: this.draftPlace.lng };
    }
    return this.previewPin;
  }

  get placeSummaryTitle(): string {
    return this.draftPlace?.osmName || '';
  }

  get placeSummaryAddress(): string {
    return this.draftPlace?.formattedAddress || '';
  }

  submit(): void {
    const name = this.name.trim();
    if (!name || this.saving) {
      return;
    }
    this.save.emit({ name, place: this.draftPlace });
  }

  onPlaceQueryChange(value: string): void {
    this.placeQuery = value;
    this.placeError = '';
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    const serial = ++this.searchSerial;
    const query = value.trim();
    if (query.length < 2) {
      this.placeResults = [];
      this.searchingPlaces = false;
      return;
    }
    this.searchTimer = setTimeout(() => {
      if (serial !== this.searchSerial) {
        return;
      }
      this.searchingPlaces = true;
      this.megagoal.searchLocationPlaces(query).subscribe({
        next: (results) => {
          if (serial !== this.searchSerial) {
            return;
          }
          this.placeResults = results;
          this.searchingPlaces = false;
        },
        error: () => {
          if (serial !== this.searchSerial) {
            return;
          }
          this.placeResults = [];
          this.searchingPlaces = false;
          this.placeError = 'Place search is unavailable.';
        }
      });
    }, 300);
  }

  clearPlaceSearch(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.searchSerial++;
    this.placeQuery = '';
    this.placeResults = [];
    this.searchingPlaces = false;
  }

  choosePlaceResult(result: LocationPlaceResult): void {
    this.clearPlaceSearch();
    this.draftPlace = {
      provider: 'osm',
      lat: result.lat,
      lng: result.lng,
      osmId: result.osmId,
      osmType: result.osmType,
      osmName: result.name,
      ...(result.formattedAddress ? { formattedAddress: result.formattedAddress } : {})
    };
  }

  onPinPicked(pin: { lat: number; lng: number }): void {
    this.draftPlace = {
      provider: 'osm',
      lat: pin.lat,
      lng: pin.lng
    };
  }

  clearPlace(): void {
    this.draftPlace = null;
    this.previewPin = this.randomStadiumPin();
  }

  private randomStadiumPin(): { lat: number; lng: number } {
    const stadium = DEFAULT_MAP_STADIUMS[Math.floor(Math.random() * DEFAULT_MAP_STADIUMS.length)];
    return { lat: stadium.lat, lng: stadium.lng };
  }
}
