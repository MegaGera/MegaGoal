import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamStatsBadgeComponent } from './team-stats-badge.component';

describe('TeamStatsBadgeComponent', () => {
  let component: TeamStatsBadgeComponent;
  let fixture: ComponentFixture<TeamStatsBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamStatsBadgeComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TeamStatsBadgeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
