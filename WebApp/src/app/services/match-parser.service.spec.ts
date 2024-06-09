import { TestBed } from '@angular/core/testing';

import { MatchParserService } from './match-parser.service';

describe('MatchParserService', () => {
  let service: MatchParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MatchParserService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
