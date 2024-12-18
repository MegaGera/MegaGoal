import { Match } from './match';

/*
    This interface is used to represent the request to create a new Match (without the _id)
*/
export type MatchRequest = Omit<Match, '_id'>;
