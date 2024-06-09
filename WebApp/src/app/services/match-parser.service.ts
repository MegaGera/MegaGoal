import { Injectable } from '@angular/core';
import { RealMatch } from '../models/realMatch';
import { Match } from '../models/match';

@Injectable({
  providedIn: 'root'
})
export class MatchParserService {

  constructor() { }

  realMatchToMatch(realMatch: RealMatch, match?: Match): Match {
    let matchModel: Match = {
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
      location: match ? match.location : '' 
    }
    return matchModel;
  }

}
