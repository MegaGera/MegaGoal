/*
  Configuration file for top leagues IDs
  These are the most interesting/important football leagues
  Keep this in sync with Server/config/topLeagues.js
*/

export const TOP_LEAGUES_IDS: number[] = [
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
  15   // FIFA Club World Cup
];

/*
  Helper function to check if a league ID is in top leagues
*/
export const isTopLeague = (leagueId: number): boolean => {
  return TOP_LEAGUES_IDS.includes(leagueId);
};

/*
  Helper function to get top leagues as comma-separated string
*/
export const getTopLeaguesString = (): string => {
  return TOP_LEAGUES_IDS.join(',');
}; 