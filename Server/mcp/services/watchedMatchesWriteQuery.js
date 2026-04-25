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

/** Minimal `req` for RabbitMQ loggers when the caller is MCP (not HTTP). */
const MCP_LOG_REQ = {
  ip: 'mcp',
  get: () => 'MegaGoal-MCP',
};

/**
 * Map a `real_matches` row to the POST /match body shape (same fields as
 * `MatchParserService.realMatchToMatch` → `matchToMatchRequest`: no statistics).
 */
function realMatchDocToCreateBody(doc) {
  if (doc == null || doc.fixture == null || doc.league == null || doc.teams == null) {
    return null;
  }
  const venue = doc.fixture.venue ?? {};
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
    location: null,
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

  const db = getDB();
  let inserted = 0;
  let skippedAlready = 0;
  let skippedInvalid = 0;
  const errors = [];
  const fixtureIdsTouched = [];

  for (const row of realRows) {
    const rawBody = realMatchDocToCreateBody(row);
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
    resolution,
    inserted,
    skipped_already_watched: skippedAlready,
    skipped_invalid: skippedInvalid,
    errors,
    truncated,
    limit: lim,
    fixture_ids: fixtureIdsTouched,
    ...(truncated
      ? {
          warning:
            'More fixtures matched the filters than were processed; narrow filters or call again with a higher limit (max 50).',
        }
      : {}),
  };
}

/**
 * Unmark watched fixtures: same filters as search_watched_matches_by_names,
 * then delete matching `matches` rows for the user (with delete logging per row).
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
