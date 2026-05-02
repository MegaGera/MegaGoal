/**
 * Resolves each club's domestic league for their latest tracked season:
 * leagues enabled in league_settings, type "League" (API-Football domestic league),
 * intersected with the team's seasons at the maximum season year.
 */

const DOMESTIC_LEAGUE_TYPE_REGEX = /^League$/i;

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<{
 *   domesticLeagueIdSet: Set<string>,
 *   leagueByIdStr: Map<string, object>,
 *   colorsByLeagueId: Map<number, object>
 * }>}
 */
export async function loadDomesticLeagueContext(db) {
  const settingsRaw = await db
    .collection('league_settings')
    .find({}, { projection: { league_id: 1, colors: 1 } })
    .toArray();

  const leagueIdsFromSettings = settingsRaw.map((s) => s.league_id).filter((id) => id != null);
  if (leagueIdsFromSettings.length === 0) {
    return {
      domesticLeagueIdSet: new Set(),
      leagueByIdStr: new Map(),
      colorsByLeagueId: new Map()
    };
  }

  const colorsByLeagueId = new Map(
    settingsRaw.map((s) => [s.league_id, s.colors && typeof s.colors === 'object' ? s.colors : {}])
  );

  const leagueDocs = await db
    .collection('leagues')
    .find({
      'league.id': { $in: leagueIdsFromSettings },
      'league.type': { $regex: DOMESTIC_LEAGUE_TYPE_REGEX }
    })
    .toArray();

  const domesticLeagueIdSet = new Set(leagueDocs.map((d) => String(d.league.id)));

  const leagueByIdStr = new Map(leagueDocs.map((d) => [String(d.league.id), d]));

  return { domesticLeagueIdSet, leagueByIdStr, colorsByLeagueId };
}

function maxSeasonNumber(seasons) {
  let max = -Infinity;
  for (const s of seasons) {
    const n = parseInt(String(s.season), 10);
    if (!Number.isNaN(n)) max = Math.max(max, n);
  }
  return max === -Infinity ? null : max;
}

/**
 * @param {object} team — parsed team document (team, venue, seasons)
 * @param {Awaited<ReturnType<typeof loadDomesticLeagueContext>>} ctx
 * @returns {object | null}
 */
export function resolveDomesticLeaguePayload(team, ctx) {
  const { domesticLeagueIdSet, leagueByIdStr, colorsByLeagueId } = ctx;
  if (!team?.seasons?.length) return null;

  const maxSeason = maxSeasonNumber(team.seasons);
  if (maxSeason == null) return null;

  const candidates = team.seasons.filter((s) => {
    const y = parseInt(String(s.season), 10);
    return !Number.isNaN(y) && y === maxSeason && domesticLeagueIdSet.has(String(s.league));
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => String(a.league).localeCompare(String(b.league)));
  const chosen = candidates[0];
  const doc = leagueByIdStr.get(String(chosen.league));
  if (!doc?.league || !doc.country) return null;

  const id = doc.league.id;
  return {
    league: doc.league,
    country: doc.country,
    colors: colorsByLeagueId.get(id) ?? {}
  };
}

/**
 * @param {object} team
 * @param {Awaited<ReturnType<typeof loadDomesticLeagueContext>>} ctx
 */
export function enrichTeamWithDomesticLeague(team, ctx) {
  return {
    ...team,
    domestic_league: resolveDomesticLeaguePayload(team, ctx)
  };
}

/**
 * @param {object[]} teams
 * @param {Awaited<ReturnType<typeof loadDomesticLeagueContext>>} ctx
 */
export function enrichTeamsWithDomesticLeague(teams, ctx) {
  return teams.map((t) => enrichTeamWithDomesticLeague(t, ctx));
}
