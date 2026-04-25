/**
 * Match status short codes — keep in sync with
 * `WebApp/src/app/config/matchStatus.ts`.
 */

export const NOT_STARTED_STATUSES = ['NS', 'TBD'];

export const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'PST', 'CANC'];

export function isNotStartedStatus(statusShort) {
  if (statusShort == null || statusShort === '') return false;
  return NOT_STARTED_STATUSES.includes(String(statusShort));
}

export function isFinishedStatus(statusShort) {
  if (statusShort == null || statusShort === '') return false;
  return FINISHED_STATUSES.includes(String(statusShort));
}
