import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GeneralMatchCardComponent } from './general-match-card.component';

describe('GeneralMatchCardComponent', () => {
  let component: GeneralMatchCardComponent;
  let fixture: ComponentFixture<GeneralMatchCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeneralMatchCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GeneralMatchCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

