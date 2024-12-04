import { Component } from '@angular/core';
import { FormsModule, FormBuilder, ReactiveFormsModule, FormGroup, Validators } from '@angular/forms';

import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamShieldF } from '@ng-icons/jam-icons';

import { MegaGoalService } from '../../services/megagoal.service';
import { Location } from '../../models/location';

@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, NgIconComponent],
  templateUrl: './locations.component.html',
  styleUrl: './locations.component.css',
  providers: [provideNgIconsConfig({
    size: '1.5em',
  }), provideIcons({ jamShieldF })]
})
export class LocationsComponent {

  locations: Location[] = [];
  newLocation: string = '';
  newLocationForm: any;
  
  constructor(private megagoal: MegaGoalService, private formBuilder: FormBuilder) {
    this.init();
  }

  init(): void {
    this.newLocationForm = this.formBuilder.group({
      name: ['', Validators.required]
    });
    this.locations = [];
    this.getLocations();
  }

  getLocations() {
    this.megagoal.getLocations().subscribe(result => {
      this.locations = <Location[]>result;
    })
  }

  addLocation() {
    if (this.newLocationForm?.valid) {
      this.megagoal.createLocation(this.newLocationForm.value).subscribe(result => {
        this.init();
      })
    }
  }

}
