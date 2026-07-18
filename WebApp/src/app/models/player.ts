/** Country row from Server `countries` collection (API-Football). */
export interface PlayerNationalityCountry {
  name: string;
  code: string | null;
  flag: string | null;
}

export interface Player {
  _id?: string;
  player: {
    id: number;
    name: string;
    firstname: string | null;
    lastname: string | null;
    age: number | null;
    birth: {
      date: string | null;
      place: string | null;
      country: string | null;
    };
    nationality: string | null;
    height: string | null;
    weight: string | null;
    number: number | null;
    position: string | null;
    photo: string;
  };
  teams?: any[]; // Optional teams information
  last_update?: Date;
  /** Resolved from `countries` by matching `player.nationality` (GET /players/:id). */
  nationality_country?: PlayerNationalityCountry | null;
}
