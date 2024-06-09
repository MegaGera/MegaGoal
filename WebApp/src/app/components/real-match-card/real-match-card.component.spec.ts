import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RealMatchCardComponent } from './real-match-card.component';

describe('RealMatchCardComponent', () => {
  let component: RealMatchCardComponent;
  let fixture: ComponentFixture<RealMatchCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RealMatchCardComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RealMatchCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
