import { AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FullscreenControl, LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, Popup, setWorkerUrl } from 'maplibre-gl';
import { SANTIAGO_BERNABEU } from '../../../models/location';

export interface LocationMapPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  matchCount: number;
}

@Component({
  selector: 'app-location-map',
  standalone: true,
  templateUrl: './location-map.component.html',
  styleUrl: './location-map.component.css'
})
export class LocationMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() marker: { lat: number; lng: number } | null = null;
  @Input() pins: LocationMapPin[] | null = null;
  @Input() interactive = false;
  @Output() pinPicked = new EventEmitter<{ lat: number; lng: number }>();
  @Output() pinSelected = new EventEmitter<string>();

  @ViewChild('mapCanvas') private mapCanvas?: ElementRef<HTMLDivElement>;

  private map?: MapLibreMap;
  private mapMarker?: Marker;
  private overviewMarkers: Marker[] = [];
  private overviewPopups: Popup[] = [];
  private overviewKey = '';
  private centeredKey = '';
  private openLabel: Popup | null = null;

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    const container = this.mapCanvas?.nativeElement;
    if (!container) {
      return;
    }
    this.zone.runOutsideAngular(() => {
      try {
        setWorkerUrl(new URL('assets/maplibre/maplibre-gl-worker.mjs', document.baseURI).href);
        this.map = new MapLibreMap({
          container,
          style: 'https://tiles.openfreemap.org/styles/bright',
          center: [SANTIAGO_BERNABEU.lng, SANTIAGO_BERNABEU.lat],
          zoom: 14
        });
        this.map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
        this.map.addControl(new FullscreenControl(), 'top-left');
        this.map.on('click', (event) => {
          if (!this.interactive) {
            return;
          }
          this.zone.run(() => {
            this.pinPicked.emit({ lat: event.lngLat.lat, lng: event.lngLat.lng });
          });
        });
        this.map.on('load', () => this.syncView());
        this.syncView();
      } catch (error) {
        console.error('Could not start the location map', error);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['marker'] || changes['pins'] || changes['interactive']) {
      this.syncView();
    }
  }

  ngOnDestroy(): void {
    this.clearOverview();
    this.mapMarker?.remove();
    this.map?.remove();
  }

  private syncView(): void {
    if (!this.map) {
      return;
    }
    if (this.pins) {
      this.mapMarker?.remove();
      this.mapMarker = undefined;
      this.renderOverview();
      return;
    }
    this.clearOverview();
    this.syncMarker();
  }

  private renderOverview(): void {
    if (!this.map || !this.pins) {
      return;
    }
    const pins = this.pins;
    const key = pins.map(pin => `${pin.id}:${pin.lat},${pin.lng}:${pin.name}:${pin.matchCount}`).join('|');
    if (key === this.overviewKey) {
      this.fitOverview(pins, key);
      return;
    }
    this.clearOverview();
    this.overviewKey = key;
    const ordered = [...pins].sort((a, b) => b.matchCount - a.matchCount);
    const counts = ordered.map(pin => Math.max(0, pin.matchCount || 0));
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    for (const pin of ordered) {
      const count = Math.max(0, pin.matchCount || 0);
      const size = this.bubbleSize(count, minCount, maxCount);
      const bubble = document.createElement('div');
      bubble.className = 'location-map-bubble';
      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      bubble.setAttribute('aria-label', pin.name);
      const marker = new Marker({ element: bubble, anchor: 'center' })
        .setLngLat([pin.lng, pin.lat])
        .addTo(this.map);
      const label = document.createElement('div');
      label.className = 'location-map-label';
      const top = document.createElement('div');
      top.className = 'location-map-label__top';
      const name = document.createElement('span');
      name.className = 'location-map-label__name';
      name.textContent = pin.name;
      const matches = document.createElement('span');
      matches.className = 'location-map-label__count';
      matches.textContent = count === 1 ? '1 match' : `${count} matches`;
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'location-map-label__edit';
      edit.setAttribute('aria-label', `Edit ${pin.name}`);
      edit.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
      edit.addEventListener('click', (event) => {
        event.stopPropagation();
        this.zone.run(() => this.pinSelected.emit(pin.id));
      });
      top.append(name, edit);
      label.append(top, matches);
      const popup = new Popup({
        offset: size / 2 + 10,
        closeButton: false,
        closeOnClick: false,
        anchor: 'bottom',
        className: 'location-map-label-popup'
      })
        .setLngLat([pin.lng, pin.lat])
        .setDOMContent(label);
      bubble.addEventListener('click', (event) => {
        event.stopPropagation();
        this.showLocationLabel(popup, pin.lng, pin.lat);
      });
      this.overviewMarkers.push(marker);
      this.overviewPopups.push(popup);
    }
    this.fitOverview(pins, key);
  }

  private showLocationLabel(popup: Popup, lng: number, lat: number): void {
    if (!this.map) {
      return;
    }
    if (this.openLabel && this.openLabel !== popup) {
      this.openLabel.remove();
    }
    if (!popup.isOpen()) {
      popup.addTo(this.map);
    }
    this.openLabel = popup;
    const zoom = Math.max(this.map.getZoom(), 13);
    this.centeredKey = `focus:${lng},${lat}`;
    this.map.easeTo({ center: [lng, lat], zoom, duration: 700 });
  }

  private bubbleSize(matchCount: number, minCount: number, maxCount: number): number {
    const minSize = 18;
    const maxSize = 64;
    const count = Math.max(0, matchCount);
    if (maxCount <= minCount) {
      return 32;
    }
    const span = Math.sqrt(maxCount) - Math.sqrt(minCount);
    const t = span === 0 ? 0 : (Math.sqrt(count) - Math.sqrt(minCount)) / span;
    return Math.round(minSize + Math.min(1, Math.max(0, t)) * (maxSize - minSize));
  }

  private fitOverview(pins: LocationMapPin[], key: string): void {
    if (!this.map) {
      return;
    }
    if (!this.map.loaded()) {
      return;
    }
    if (this.centeredKey === key) {
      this.map.resize();
      return;
    }
    this.centeredKey = key;
    this.map.resize();
    if (pins.length === 0) {
      this.map.easeTo({ center: [SANTIAGO_BERNABEU.lng, SANTIAGO_BERNABEU.lat], zoom: 2 });
      return;
    }
    if (pins.length === 1) {
      this.map.easeTo({ center: [pins[0].lng, pins[0].lat], zoom: 14 });
      return;
    }
    const bounds = new LngLatBounds();
    pins.forEach(pin => bounds.extend([pin.lng, pin.lat]));
    this.map.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 700 });
  }

  private clearOverview(): void {
    this.overviewMarkers.forEach(marker => marker.remove());
    this.overviewPopups.forEach(popup => popup.remove());
    this.overviewMarkers = [];
    this.overviewPopups = [];
    this.overviewKey = '';
    this.openLabel = null;
  }

  private syncMarker(): void {
    if (!this.map) {
      return;
    }
    const marker = this.marker;
    if (!marker) {
      this.mapMarker?.remove();
      this.mapMarker = undefined;
      this.moveTo(SANTIAGO_BERNABEU.lng, SANTIAGO_BERNABEU.lat, 'default');
      return;
    }

    const lngLat: [number, number] = [marker.lng, marker.lat];
    if (!this.mapMarker) {
      this.mapMarker = new Marker({ color: '#dc143c', draggable: this.interactive })
        .setLngLat(lngLat)
        .addTo(this.map);
      this.mapMarker.on('dragend', () => {
        const next = this.mapMarker?.getLngLat();
        if (!next || !this.interactive) {
          return;
        }
        this.zone.run(() => {
          this.pinPicked.emit({ lat: next.lat, lng: next.lng });
        });
      });
    } else {
      this.mapMarker.setLngLat(lngLat);
      this.mapMarker.setDraggable(this.interactive);
    }
    this.moveTo(marker.lng, marker.lat, `${marker.lat},${marker.lng}`);
  }

  private moveTo(lng: number, lat: number, key: string): void {
    if (!this.map || this.centeredKey === key) {
      this.map?.resize();
      return;
    }
    this.centeredKey = key;
    this.map.resize();
    this.map.easeTo({ center: [lng, lat] });
  }
}
