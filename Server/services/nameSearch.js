export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 20;

const INDEX_TTL_MS = 10 * 60 * 1000;

function clampLimit(limit) {
  const n = limit == null ? DEFAULT_LIMIT : Number(limit);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(n), 1), MAX_LIMIT);
}

/**
 * Lowercase, strip diacritics/punctuation, collapse whitespace.
 * "Mbappé", "Núñez", "N'Golo" → "mbappe", "nunez", "ngolo"
 */
function foldName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ø/g, 'o')
    .replace(/ł/g, 'l')
    .replace(/đ/g, 'd')
    .replace(/[''`´.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function uniqueFoldedFields(values) {
  const seen = new Set();
  const fields = [];
  for (const value of values) {
    const folded = foldName(value);
    if (!folded || seen.has(folded)) continue;
    seen.add(folded);
    fields.push(folded);
  }
  return fields;
}

function prepareQuery(query) {
  const folded = foldName(query);
  const tokens = folded ? folded.split(' ').filter(Boolean) : [];
  return { folded, tokens };
}

function wordMatchesToken(word, token) {
  if (word === token || word.startsWith(token)) return true;
  return token.length >= 5 && word.includes(token);
}

function recordMatches(foldedFields, tokens) {
  const words = [];
  for (const field of foldedFields) {
    for (const word of field.split(' ')) {
      if (word) words.push(word);
    }
  }
  return tokens.every((token) =>
    words.some((word) => wordMatchesToken(word, token))
  );
}

/**
 * Token AND match on a display name (exact / prefix / long infix), same rules as search.
 */
function matchesNameQuery(name, query) {
  const prepared = prepareQuery(query);
  if (!prepared.tokens.length) return true;
  const folded = foldName(name);
  if (!folded) return false;
  return recordMatches([folded], prepared.tokens);
}

/** Exact full-name hit. Single-token fields (firstname/lastname alone) use a softer value. */
const EXACT_FIELD = 1000;
const EXACT_FRAGMENT = 220;
/** Field starts with the full query string. */
const PREFIX_FIELD = 520;
const PREFIX_FRAGMENT = 300;
/** Query appears as a substring of the field. */
const INCLUDES_FIELD = 180;
/** Max bonus when a token is a long prefix of a longer word (progressive typing). */
const PREFIX_COMPLETION_MAX = 100;

function scoreOneField(field, queryFolded, tokens) {
  const words = field.split(' ').filter(Boolean);
  if (words.length === 0) return 0;

  const isFragment = words.length === 1;
  let score = 0;
  if (field === queryFolded) {
    score += isFragment ? EXACT_FRAGMENT : EXACT_FIELD;
  } else if (field.startsWith(queryFolded)) {
    score += isFragment ? PREFIX_FRAGMENT : PREFIX_FIELD;
  }
  if (queryFolded.length >= 2 && field.includes(queryFolded)) {
    score += INCLUDES_FIELD;
  }

  const lastWord = words[words.length - 1];
  const lastToken = tokens[tokens.length - 1];
  if (lastWord === lastToken) score += 320;
  else if (lastWord.startsWith(lastToken)) score += 170;

  const firstWord = words[0];
  const firstToken = tokens[0];
  if (firstWord === firstToken) score += 90;
  else if (firstWord.startsWith(firstToken)) score += 40;

  for (const token of tokens) {
    if (words.some((word) => word === token)) {
      score += 80;
    } else {
      const prefixWord = words.find((word) => word.startsWith(token));
      if (prefixWord) {
        score += 45;
        // Progressive typing: reward how much of the longer word is already typed.
        if (token.length >= 2 && prefixWord.length > token.length) {
          score += Math.round(
            PREFIX_COMPLETION_MAX * (token.length / prefixWord.length)
          );
        }
      } else if (
        token.length >= 5 &&
        words.some((word) => word.includes(token))
      ) {
        score += 12;
      }
    }
  }

  const extraWords = Math.max(0, words.length - tokens.length);
  score -= extraWords * 30;
  score -= Math.min(field.length, 12);
  return score;
}

function scoreFoldedFields(foldedFields, preparedQuery) {
  const { folded, tokens } = preparedQuery;
  if (!tokens.length || !recordMatches(foldedFields, tokens)) return 0;

  let best = 0;
  for (const field of foldedFields) {
    best = Math.max(best, scoreOneField(field, folded, tokens));
  }
  if (foldedFields.length > 1) {
    best = Math.max(
      best,
      scoreOneField(foldedFields.join(' '), folded, tokens)
    );
  }
  return best;
}

/**
 * Small tie-breaker from career/club activity. Kept low so name score wins.
 */
function popularityFromYears(years) {
  if (!Array.isArray(years) || years.length === 0) return 0;
  const nums = years.map(Number).filter(Number.isFinite);
  if (!nums.length) return 0;
  const maxSeason = Math.max(...nums);
  const recency =
    maxSeason >= 2023 ? 14 : maxSeason >= 2018 ? 9 : maxSeason >= 2010 ? 4 : 1;
  return Math.min(nums.length, 18) + recency;
}

/**
 * Rank index rows by name relevance. Each row needs `foldedFields` and `item`.
 * Optional `boostForRow(row)` adds match-context points (server-side only).
 */
function rankItems(rows, query, limit, { boostForRow } = {}) {
  const prepared = prepareQuery(query);
  if (!prepared.tokens.length) {
    return { items: [], truncated: false };
  }

  const boostFn = typeof boostForRow === 'function' ? boostForRow : null;
  const scored = [];
  for (const row of rows) {
    const nameScore = scoreFoldedFields(row.foldedFields, prepared);
    if (nameScore <= 0) continue;
    const boost = boostFn ? boostFn(row) || 0 : 0;
    scored.push({
      item: row.item,
      score: nameScore + (row.popularity || 0) + boost,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const lim = clampLimit(limit);
  return {
    items: scored.slice(0, lim).map((entry) => entry.item),
    truncated: scored.length > lim,
  };
}

function createIndexCache(buildIndex) {
  let rows = null;
  let loadedAtMs = 0;
  let loadPromise = null;

  async function getIndex(db, { force = false } = {}) {
    const fresh =
      !force && rows != null && Date.now() - loadedAtMs < INDEX_TTL_MS;
    if (fresh) return rows;

    if (!loadPromise) {
      loadPromise = Promise.resolve()
        .then(() => buildIndex(db))
        .then((next) => {
          rows = next;
          loadedAtMs = Date.now();
          return rows;
        })
        .finally(() => {
          loadPromise = null;
        });
    }

    if (rows != null && !force) return rows;
    return loadPromise;
  }

  return { getIndex };
}

export {
  INDEX_TTL_MS,
  clampLimit,
  createIndexCache,
  foldName,
  matchesNameQuery,
  popularityFromYears,
  prepareQuery,
  rankItems,
  uniqueFoldedFields,
};
