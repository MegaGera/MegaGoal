// Centralized football match status references and helpers

export const NOT_STARTED_STATUSES: ReadonlyArray<string> = ['NS', 'TBD'];

export const FINISHED_STATUSES: ReadonlyArray<string> = ['FT', 'AET', 'PEN', 'PST', 'CANC'];

export function isNotStartedStatus(statusShort: string | undefined | null): boolean {
  if (!statusShort) return false;
  return NOT_STARTED_STATUSES.includes(statusShort);
}

export function isFinishedStatus(statusShort: string | undefined | null): boolean {
  if (!statusShort) return false;
  return FINISHED_STATUSES.includes(statusShort);
}


