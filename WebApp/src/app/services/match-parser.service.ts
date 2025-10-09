import { Injectable, ɵgetUnknownElementStrictMode } from '@angular/core';
import { RealMatch } from '../models/realMatch';
import { Match } from '../models/match';
import { MatchRequest } from '../models/matchRequest';

@Injectable({
  providedIn: 'root'
})
export class MatchParserService {

  constructor() { }

  realMatchToMatch(realMatch: RealMatch, match?: Match): Match {
    let matchModel: Match = {
      _id:  match ? match._id : '', 
      fixture: {
        id: realMatch.fixture.id,
        timestamp: realMatch.fixture.timestamp
      },
      league: {
        id: realMatch.league.id,
        name: realMatch.league.name,
        round: realMatch.league.round,
        season: realMatch.league.season
      },
      teams: {
        home: {
          id: realMatch.teams.home.id,
          name: realMatch.teams.home.name
        },
        away: {
          id: realMatch.teams.away.id,
          name: realMatch.teams.away.name
        }
      },
      goals: {
        home: realMatch.goals.home,
        away: realMatch.goals.away
      },
      location: match ? match.location : '',
      status: realMatch.fixture.status.short,
      venue: {id: realMatch.fixture.venue.id, name: realMatch.fixture.venue.name},
      statistics: realMatch.statistics
    }
    return matchModel;
  }
  
  matchToMatchRequest(match: Match): MatchRequest {
    const { _id, statistics, ...matchRequest } = match;
    return matchRequest;
  }

}
