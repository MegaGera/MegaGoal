import { Component } from '@angular/core';
import { FormsModule, FormBuilder, ReactiveFormsModule, FormGroup, Validators } from '@angular/forms';

import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { jamShieldF, jamEyeF } from '@ng-icons/jam-icons';

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
  }), provideIcons({ jamShieldF, jamEyeF })]
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
    this.getLocationsCounts();
  }

  getLocationsCounts() {
    this.megagoal.getLocationsCounts().subscribe(result => {
      this.locations = <Location[]>result;
      this.locations.sort((a, b) => a.matchCount > b.matchCount ? -1 : 1);
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
