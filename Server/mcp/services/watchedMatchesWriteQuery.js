import { getDB } from '../../config/db.js';
import {
  buildMatchDocument,
  parseCreateMatchBody,
  parseMatch,
} from '../../entities/matchEntity.js';
import { logMatchCreated, logMatchDeleted } from '../../controllers/logController.js';
import {
  searchRealMatchesByNames,
  searchWatchedMatchesByNames,
} from './matchSearchQuery.js';
import { searchUserLocationsByName } from './locationSearchQuery.js';
import { MAX_LIMIT } from './teamSearchQuery.js';

/** Minimal `req` for RabbitMQ loggers when the caller is MCP (not HTTP). */
const MCP_LOG_REQ = {
  ip: 'mcp',
  get: () => 'MegaGoal-MCP',
};

/**
 * Map a `real_matches` row to the POST /match body shape (same fields as
 * `MatchParserService.realMatchToMatch` → `matchToMatchRequest`: no statistics).
 */
function realMatchDocToCreateBody(doc, { locationUuid } = {}) {
  if (doc == null || doc.fixture == null || doc.league == null || doc.teams == null) {
    return null;
  }
  const venue = doc.fixture.venue ?? {};
  const loc =
    locationUuid != null && String(locationUuid).trim() !== ''
      ? String(locationUuid).trim()
      : null;
  return {
    fixture: {
      id: doc.fixture.id,
      timestamp: doc.fixture.timestamp,
    },
    league: {
      id: doc.league.id,
      name: doc.league.name,
      round: doc.league.round != null ? String(doc.league.round) : '',
      season: doc.league.season,
    },
    teams: {
      home: {
        id: doc.teams.home.id,
        name: doc.teams.home.name,
      },
      away: {
        id: doc.teams.away.id,
        name: doc.teams.away.name,
      },
    },
    goals: {
      home: doc.goals?.home ?? null,
      away: doc.goals?.away ?? null,
    },
    location: loc,
    status:
      doc.fixture.status?.short != null
        ? String(doc.fixture.status.short)
        : undefined,
    venue: {
      id: venue.id != null ? Number(venue.id) : null,
      name: venue.name != null ? String(venue.name) : null,
    },
  };
}

/**
 * Mark fixtures as watched: resolve `real_matches` with the same name/date/events
 * filters as search tools, then insert into `matches` (skip duplicates).
 */
export async function markWatchedMatchesByNames({
  username,
  teamName,
  team2Name,
  leagueName,
  countryName,
  locationName,
  seasons,
  dateFrom,
  dateTo,
  events,
  limit,
}) {
  const {
    matches: realRows,
    truncated,
    limit: lim,
    resolution,
    empty_reason: emptyReason,
  } = await searchRealMatchesByNames({
    teamName,
    team2Name,
    leagueName,
    countryName,
    seasons,
    dateFrom,
    dateTo,
    events,
    limit,
  });

  if (emptyReason != null) {
    return {
      ok: false,
      action: 'mark',
      empty_reason: emptyReason,
      resolution,
      inserted: 0,
      skipped_already_watched: 0,
      skipped_invalid: 0,
      errors: [],
      truncated: false,
      limit: lim,
      fixture_ids: [],
    };
  }

  let chosenLocationUuid = null;
  let locationResolutionTruncated = false;
  let locationNameUnmatched = false;
  const locQuery = locationName != null ? String(locationName).trim() : '';
  if (locQuery.length > 0) {
    const locRes = await searchUserLocationsByName({
      username,
      query: locQuery,
      limit: MAX_LIMIT,
    });
    locationResolutionTruncated = locRes.truncated;
    if (locRes.location_ids.length > 0) {
      chosenLocationUuid = locRes.location_ids[0];
    } else {
      locationNameUnmatched = true;
    }
  }

  const mergedResolution = {
    ...resolution,
    ...(locQuery.length > 0
      ? { location_name_resolution_truncated: locationResolutionTruncated }
      : {}),
  };

  const db = getDB();
  let inserted = 0;
  let skippedAlready = 0;
  let skippedInvalid = 0;
  const errors = [];
  const fixtureIdsTouched = [];

  for (const row of realRows) {
    const rawBody = realMatchDocToCreateBody(row, {
      locationUuid: chosenLocationUuid,
    });
    if (rawBody == null) {
      skippedInvalid += 1;
      errors.push({
        fixture_id: row?.fixture?.id ?? null,
        message: 'invalid_real_match_shape',
      });
      continue;
    }

    let body;
    try {
      body = parseCreateMatchBody(rawBody);
    } catch (e) {
      skippedInvalid += 1;
      errors.push({
        fixture_id: rawBody.fixture.id,
        message: e?.message ?? 'parse_create_match_failed',
      });
      continue;
    }

    const exists = await db.collection('matches').findOne({
      'fixture.id': body.fixture.id,
      'user.username': username,
    });
    if (exists) {
      skippedAlready += 1;
      continue;
    }

    try {
      const match = buildMatchDocument({ body, username });
      const result = await db.collection('matches').insertOne(match);
      inserted += 1;
      fixtureIdsTouched.push(body.fixture.id);
      await logMatchCreated(
        username,
        { ...match, _id: result.insertedId },
        MCP_LOG_REQ,
      );
    } catch (e) {
      errors.push({
        fixture_id: body.fixture.id,
        message: e?.message ?? 'insert_failed',
      });
    }
  }

  return {
    ok: errors.length === 0,
    action: 'mark',
    resolution: mergedResolution,
    inserted,
    skipped_already_watched: skippedAlready,
    skipped_invalid: skippedInvalid,
    errors,
    truncated,
    limit: lim,
    fixture_ids: fixtureIdsTouched,
    ...(locationNameUnmatched ? { location_name_unmatched: true } : {}),
    ...(truncated
      ? {
          warning:
            'More fixtures matched the filters than were processed; narrow filters or call again with a higher limit (max 50).',
        }
      : {}),
  };
}

/**
 * Unmark watched fixtures: same **fixture** filters as search by names (team,
 * league, country, seasons, dates, events). **`location_name` is ignored** here
 * so bulk unmark by location alone is not supported.
 */
export async function unmarkWatchedMatchesByNames({
  username,
  teamName,
  team2Name,
  leagueName,
  countryName,
  seasons,
  dateFrom,
  dateTo,
  events,
  limit,
}) {
  const {
    matches,
    truncated,
    limit: lim,
    resolution,
    empty_reason: emptyReason,
  } = await searchWatchedMatchesByNames({
    username,
    teamName,
    team2Name,
    leagueName,
    countryName,
    seasons,
    dateFrom,
    dateTo,
    events,
    limit,
  });

  if (emptyReason != null) {
    return {
      ok: false,
      action: 'unmark',
      empty_reason: emptyReason,
      resolution,
      deleted: 0,
      errors: [],
      truncated: false,
      limit: lim,
      fixture_ids: [],
    };
  }

  const db = getDB();
  let deleted = 0;
  const errors = [];
  const fixtureIdsTouched = [];

  for (const row of matches) {
    const fixtureId = row?.fixture?.id;
    if (fixtureId == null || !Number.isFinite(Number(fixtureId))) {
      errors.push({ fixture_id: fixtureId, message: 'missing_fixture_id' });
      continue;
    }

    try {
      const validated = parseMatch(row);
      const filter = {
        'fixture.id': validated.fixture.id,
        'user.username': username,
      };
      const del = await db.collection('matches').deleteOne(filter);
      if (del.deletedCount === 1) {
        deleted += 1;
        fixtureIdsTouched.push(validated.fixture.id);
        await logMatchDeleted(username, validated, MCP_LOG_REQ);
      }
    } catch (e) {
      errors.push({
        fixture_id: fixtureId,
        message: e?.message ?? 'delete_failed',
      });
    }
  }

  return {
    ok: errors.length === 0,
    action: 'unmark',
    resolution,
    deleted,
    errors,
    truncated,
    limit: lim,
    fixture_ids: fixtureIdsTouched,
    ...(truncated
      ? {
          warning:
            'More watched matches matched than were processed; narrow filters or raise limit (max 50).',
        }
      : {}),
  };
}
