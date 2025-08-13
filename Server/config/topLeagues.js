/*
  Configuration file for top leagues IDs
  These are the most interesting/important football leagues
*/

export const TOP_LEAGUES_IDS = [
  2,   // UEFA Champions League
  3,   // UEFA Europa League
  39,  // Premier League
  140, // La Liga
  143, // Copa del Rey
  45,  // FA Cup
  141, // Copa del Rey
  135, // Serie A
  78,  // Bundesliga
  61,  // Ligue 1
  556, // Super Lig
  531, // Primeira Liga
  848, // Eredivisie
  4,   // UEFA Europa Conference League
  1,   // World Cup
  9,   // Copa Libertadores
  40,  // Championship
  41,  // League One
  42,  // League Two
  48,  // EFL Cup
  5,   // UEFA Nations League
  15,  // FIFA Club World Cup
  10,  // Friendlies
  667, // Friendlies Clubs
];

/*
  Helper function to create MongoDB $or query for top leagues
*/
export const getTopLeaguesQuery = () => {
  return {
    $or: TOP_LEAGUES_IDS.map(leagueId => ({ "league.id": leagueId }))
  };
};

/*
  Helper function to create MongoDB $in query for top leagues
*/
export const getTopLeaguesInQuery = () => {
  return { $in: TOP_LEAGUES_IDS };
};

/*
  Helper function to get top leagues as comma-separated string
*/
export const getTopLeaguesString = () => {
  return TOP_LEAGUES_IDS.join(',');
}; 