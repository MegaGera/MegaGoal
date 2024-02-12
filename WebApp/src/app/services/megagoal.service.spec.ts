import { TestBed } from '@angular/core/testing';

import { MegaGoalService } from './megagoal.service';

describe('MegaGoalService', () => {
  let service: MegaGoalService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MegaGoalService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
