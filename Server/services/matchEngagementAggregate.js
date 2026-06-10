import { getDB } from '../config/db.js';
import {
  MATCH_REACTION_EMOJIS,
  USER_PICK_PLAYER_KEYS
} from '../entities/matchEntity.js';

const PLAYER_PICK_KEY_TO_FIELD = {
  mvp: 'mvp',
  bluff: 'bluff',
  underrated: 'underrated',
  most_entertaining: 'most_entertaining'
};

const buildPlayerPickMatch = (field) => {
  if (field === 'bluff') {
    return {
      $or: [
        { 'user_picks.bluff.id': { $type: 'number' } },
        { 'user_picks.worst.id': { $type: 'number' } }
      ]
    };
  }
  return {
    [`user_picks.${field}.id`]: { $type: 'number' }
  };
};

const buildPlayerPickExpression = (field) => {
  if (field === 'bluff') {
    return { $ifNull: ['$user_picks.bluff', '$user_picks.worst'] };
  }
  return `$user_picks.${field}`;
};

const buildPlayerVoteFacetStages = (field) => [
  { $match: buildPlayerPickMatch(field) },
  { $addFields: { _pick: buildPlayerPickExpression(field) } },
  { $match: { '_pick.id': { $type: 'number' } } },
  {
    $group: {
      _id: '$_pick.id',
      votes: { $sum: 1 },
      player: { $first: '$_pick' }
    }
  },
  { $sort: { votes: -1, '_id': 1 } }
];

const buildReactionCounts = (rows) => {
  const counts = new Map(MATCH_REACTION_EMOJIS.map((emoji) => [emoji, 0]));
  for (const row of rows) {
    if (counts.has(row._id)) {
      counts.set(row._id, row.count);
    }
  }
  return MATCH_REACTION_EMOJIS.map((reaction) => ({
    reaction,
    count: counts.get(reaction) ?? 0
  }));
};

const buildPlayerVoteCounts = (rows) =>
  rows
    .filter((row) => row?.player?.id != null)
    .map((row) => ({
      id: row.player.id,
      name: row.player.name,
      team_id: row.player.team_id,
      team_name: row.player.team_name,
      votes: row.votes
    }));

const buildRatingSummary = (rows) => {
  const summary = rows[0];
  if (!summary) {
    return { average: null, count: 0 };
  }
  const average =
    summary.average == null
      ? null
      : Math.round(summary.average * 100) / 100;
  return {
    average,
    count: summary.count ?? 0
  };
};

/**
 * Aggregate reactions, ratings, and player votes for a fixture across all users.
 */
export async function getMatchEngagementByFixtureId(fixtureId) {
  const db = getDB();
  const facet = {
    reactions: [
      { $match: { reactions: { $exists: true, $type: 'array', $ne: [] } } },
      { $unwind: '$reactions' },
      { $group: { _id: '$reactions', count: { $sum: 1 } } }
    ],
    ratings: [
      { $match: { 'user_picks.rating': { $exists: true, $ne: null } } },
      {
        $group: {
          _id: null,
          average: { $avg: '$user_picks.rating' },
          count: { $sum: 1 }
        }
      }
    ]
  };

  for (const key of USER_PICK_PLAYER_KEYS) {
    facet[key] = buildPlayerVoteFacetStages(PLAYER_PICK_KEY_TO_FIELD[key]);
  }

  const [result] = await db
    .collection('matches')
    .aggregate([
      { $match: { 'fixture.id': fixtureId } },
      { $facet: facet }
    ])
    .toArray();

  const playerVotes = {};
  for (const key of USER_PICK_PLAYER_KEYS) {
    playerVotes[key] = buildPlayerVoteCounts(result?.[key] ?? []);
  }

  return {
    fixture_id: fixtureId,
    reactions: buildReactionCounts(result?.reactions ?? []),
    rating: buildRatingSummary(result?.ratings ?? []),
    player_votes: playerVotes
  };
}
