import { getDB } from '../../config/db.js';
import {
  FINISHED_STATUSES,
  isFinishedStatus,
  isNotStartedStatus,
  NOT_STARTED_STATUSES,
} from '../../config/matchStatus.js';
import { REAL_MATCH_LIST_PROJECTION } from '../../config/matchProjection.js';

/**
 * UTC calendar day bounds as Unix seconds (same idea as fixture.timestamp).
 */
export function getUtcDayBoundsUnixSeconds(referenceDate = new Date()) {
  const y = referenceDate.getUTCFullYear();
  const m = referenceDate.getUTCMonth();
  const d = referenceDate.getUTCDate();
  const startSec = Date.UTC(y, m, d) / 1000;
  const endSec = Date.UTC(y, m, d + 1) / 1000;
  const utcDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { startSec, endSec, utcDate };
}

/**
 * All `real_matches` with kickoff on the given UTC day, sorted by kickoff time.
 * Each row includes a `live` object: kickoff vs server "now", and finished /
 * not-started flags using the same status.short legend as the WebApp.
 */
export async function getLiveRealMatchesForUtcDay(referenceDate = new Date()) {
  const { startSec, endSec, utcDate } = getUtcDayBoundsUnixSeconds(referenceDate);
  const nowSec = Date.now() / 1000;

  const db = getDB();
  const raw = await db
    .collection('real_matches')
    .find(
      { 'fixture.timestamp': { $gte: startSec, $lt: endSec } },
      {
        projection: REAL_MATCH_LIST_PROJECTION,
        sort: { 'fixture.timestamp': 1 },
      },
    )
    .toArray();

  const matches = raw.map((doc) => {
    const ts = doc.fixture?.timestamp;
    const short = doc.fixture?.status?.short;
    const kickoffPassed =
      ts != null && Number.isFinite(Number(ts)) && nowSec >= Number(ts);

    return {
      ...doc,
      live: {
        kickoff_passed: kickoffPassed,
        /** True when `fixture.status.short` is one of the finished codes (see `status_legend`). */
        status_finished: isFinishedStatus(short),
        /** True when `fixture.status.short` is NS or TBD. */
        status_not_started: isNotStartedStatus(short),
        /** Kickoff time has passed but status is not in the finished set (may be live, HT, etc.). */
        kickoff_passed_and_not_finished:
          kickoffPassed && !isFinishedStatus(short),
        status_short: short ?? null,
        fixture_timestamp: ts ?? null,
      },
    };
  });

  return {
    utc_date: utcDate,
    day_start_unix: startSec,
    day_end_unix: endSec,
    now_unix: nowSec,
    status_legend: {
      not_started: [...NOT_STARTED_STATUSES],
      finished: [...FINISHED_STATUSES],
    },
    count: matches.length,
    matches,
  };
}
