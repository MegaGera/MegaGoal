import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamStatsListComponent } from './team-stats-list.component';

describe('TeamStatsListComponent', () => {
  let component: TeamStatsListComponent;
  let fixture: ComponentFixture<TeamStatsListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamStatsListComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TeamStatsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
