import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeagueHeaderComponent } from './league-header.component';

describe('LeagueHeaderComponent', () => {
  let component: LeagueHeaderComponent;
  let fixture: ComponentFixture<LeagueHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeagueHeaderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeagueHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

