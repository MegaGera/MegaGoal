import { getDB } from './db.js';

/**
 * Creates all necessary indexes for optimal query performance
 * This function should be called once after database connection is established
 */
export const createIndexes = async () => {
  try {
    const db = getDB();
    
    console.log('Creating database indexes...');
    
    // ==================== real_matches Collection ====================
    const realMatchesCollection = db.collection('real_matches');
    
    // Single field indexes for frequent queries
    await realMatchesCollection.createIndex({ 'fixture.id': 1 }, { background: true });
    await realMatchesCollection.createIndex({ 'fixture.timestamp': 1 }, { background: true });
    await realMatchesCollection.createIndex({ 'fixture.status.short': 1 }, { background: true });
    await realMatchesCollection.createIndex({ 'league.id': 1 }, { background: true });
    await realMatchesCollection.createIndex({ 'league.season': 1 }, { background: true });
    await realMatchesCollection.createIndex({ 'league.country': 1 }, { background: true });
    await realMatchesCollection.createIndex({ 'teams.home.id': 1 }, { background: true });
    await realMatchesCollection.createIndex({ 'teams.away.id': 1 }, { background: true });
    
    // Compound indexes for common query patterns
    // League and season filtering together
    await realMatchesCollection.createIndex({ 'league.id': 1, 'league.season': 1 }, { background: true });
    
    // Team filtering (home or away)
    await realMatchesCollection.createIndex({ 'teams.home.id': 1, 'teams.away.id': 1 }, { background: true });
    
    // Fixture ID with timestamp for date-based queries
    await realMatchesCollection.createIndex({ 'fixture.id': 1, 'fixture.timestamp': -1 }, { background: true });
    
    // For queries checking existence of statistics, lineups, events
    await realMatchesCollection.createIndex({ 'statistics': 1 }, { background: true, sparse: true });
    await realMatchesCollection.createIndex({ 'lineups': 1 }, { background: true, sparse: true });
    await realMatchesCollection.createIndex({ 'events': 1 }, { background: true, sparse: true });
    
    // Indexes for nested array queries (lineups and events)
    // These help with queries on lineups.startXI.player.id
    await realMatchesCollection.createIndex({ 'lineups.startXI.player.id': 1 }, { background: true, sparse: true });
    await realMatchesCollection.createIndex({ 'lineups.team.id': 1 }, { background: true, sparse: true });
    
    // For event queries (type, player.id, assist.id, team.id)
    // Note: MongoDB can use these for $filter operations in aggregation pipelines
    await realMatchesCollection.createIndex({ 'events.type': 1 }, { background: true, sparse: true });
    await realMatchesCollection.createIndex({ 'events.player.id': 1 }, { background: true, sparse: true });
    await realMatchesCollection.createIndex({ 'events.assist.id': 1 }, { background: true, sparse: true });
    await realMatchesCollection.createIndex({ 'events.team.id': 1 }, { background: true, sparse: true });
    
    // Compound index for common aggregation pipeline queries: fixture.id with lineups/events filtering
    await realMatchesCollection.createIndex({ 
      'fixture.id': 1, 
      'lineups.startXI.player.id': 1 
    }, { background: true, sparse: true });
    
    // For admin queries checking missing statistics/lineups/events
    await realMatchesCollection.createIndex({ 
      'fixture.id': 1, 
      'statistics': 1, 
      'lineups': 1, 
      'events': 1 
    }, { background: true, sparse: true });
    
    console.log('✓ real_matches indexes created');
    
    // ==================== players Collection ====================
    const playersCollection = db.collection('players');
    
    // Primary lookup by player ID
    await playersCollection.createIndex({ 'player.id': 1 }, { background: true, unique: true });
    
    // Text search on player name (supports regex queries)
    await playersCollection.createIndex({ 'player.name': 1 }, { background: true });
    
    // Filtering indexes
    await playersCollection.createIndex({ 'player.position': 1 }, { background: true });
    await playersCollection.createIndex({ 'player.nationality': 1 }, { background: true });
    
    // For teams array existence checks
    await playersCollection.createIndex({ 'teams': 1 }, { background: true, sparse: true });
    
    // Compound indexes for common query patterns
    // Position + nationality filtering
    await playersCollection.createIndex({ 'player.position': 1, 'player.nationality': 1 }, { background: true });
    
    // Name search with position filter
    await playersCollection.createIndex({ 'player.name': 1, 'player.position': 1 }, { background: true });
    
    console.log('✓ players indexes created');
    
    // ==================== matches Collection ====================
    const matchesCollection = db.collection('matches');
    
    // Single field indexes
    await matchesCollection.createIndex({ 'fixture.id': 1 }, { background: true });
    await matchesCollection.createIndex({ 'user.username': 1 }, { background: true });
    await matchesCollection.createIndex({ 'league.season': 1 }, { background: true });
    await matchesCollection.createIndex({ 'location': 1 }, { background: true });
    await matchesCollection.createIndex({ 'teams.home.id': 1 }, { background: true });
    await matchesCollection.createIndex({ 'teams.away.id': 1 }, { background: true });
    
    // Compound indexes for most common query patterns
    // Most frequent: get matches by user and fixture
    await matchesCollection.createIndex({ 
      'fixture.id': 1, 
      'user.username': 1 
    }, { background: true });
    
    // User's matches with team filter
    await matchesCollection.createIndex({ 
      'user.username': 1, 
      'teams.home.id': 1, 
      'teams.away.id': 1 
    }, { background: true });
    
    // User's matches with season filter
    await matchesCollection.createIndex({ 
      'user.username': 1, 
      'league.season': 1 
    }, { background: true });
    
    // User's matches with location filter
    await matchesCollection.createIndex({ 
      'user.username': 1, 
      'location': 1 
    }, { background: true });
    
    // Distinct fixture.id queries (for admin endpoints)
    await matchesCollection.createIndex({ 'fixture.id': 1 }, { background: true });
    
    console.log('✓ matches indexes created');
    
    console.log('✓ All database indexes created successfully');
    
  } catch (error) {
    console.error('Error creating indexes:', error);
    // Don't throw - indexes might already exist, which is fine
    // In production, you might want to log this differently
    if (error.code !== 85 && error.code !== 86) { // 85 = IndexOptionsConflict, 86 = IndexKeySpecsConflict
      throw error;
    }
  }
};

/**
 * Creates indexes only if they don't already exist
 * Useful for avoiding errors on repeated calls
 */
export const ensureIndexes = async () => {
  try {
    const db = getDB();
    
    console.log('Ensuring database indexes exist...');
    
    const realMatchesCollection = db.collection('real_matches');
    const playersCollection = db.collection('players');
    const matchesCollection = db.collection('matches');
    
    // Get existing indexes
    const existingRealMatchesIndexes = await realMatchesCollection.indexes();
    const existingPlayersIndexes = await playersCollection.indexes();
    const existingMatchesIndexes = await matchesCollection.indexes();
    
    const getIndexKey = (index) => {
      const key = index.key || {};
      return JSON.stringify(key);
    };
    
    const indexExists = (existingIndexes, keyString) => {
      return existingIndexes.some(idx => getIndexKey(idx) === keyString);
    };
    
    // Create real_matches indexes
    const realMatchesIndexes = [
      { key: { 'fixture.id': 1 } },
      { key: { 'fixture.timestamp': 1 } },
      { key: { 'fixture.status.short': 1 } },
      { key: { 'league.id': 1 } },
      { key: { 'league.season': 1 } },
      { key: { 'league.country': 1 } },
      { key: { 'teams.home.id': 1 } },
      { key: { 'teams.away.id': 1 } },
      { key: { 'league.id': 1, 'league.season': 1 } },
      { key: { 'teams.home.id': 1, 'teams.away.id': 1 } },
      { key: { 'fixture.id': 1, 'fixture.timestamp': -1 } },
      { key: { 'statistics': 1 }, sparse: true },
      { key: { 'lineups': 1 }, sparse: true },
      { key: { 'events': 1 }, sparse: true },
      { key: { 'lineups.startXI.player.id': 1 }, sparse: true },
      { key: { 'lineups.team.id': 1 }, sparse: true },
      { key: { 'events.type': 1 }, sparse: true },
      { key: { 'events.player.id': 1 }, sparse: true },
      { key: { 'events.assist.id': 1 }, sparse: true },
      { key: { 'events.team.id': 1 }, sparse: true },
      { key: { 'fixture.id': 1, 'lineups.startXI.player.id': 1 }, sparse: true },
      { key: { 'fixture.id': 1, 'statistics': 1, 'lineups': 1, 'events': 1 }, sparse: true },
    ];
    
    for (const idxSpec of realMatchesIndexes) {
      const keyString = JSON.stringify(idxSpec.key);
      if (!indexExists(existingRealMatchesIndexes, keyString)) {
        await realMatchesCollection.createIndex(idxSpec.key, { 
          background: true, 
          sparse: idxSpec.sparse || false 
        });
        console.log(`  Created index: real_matches.${keyString}`);
      }
    }
    
    // Create players indexes
    const playersIndexes = [
      { key: { 'player.id': 1 }, unique: true },
      { key: { 'player.name': 1 } },
      { key: { 'player.position': 1 } },
      { key: { 'player.nationality': 1 } },
      { key: { 'teams': 1 }, sparse: true },
      { key: { 'player.position': 1, 'player.nationality': 1 } },
      { key: { 'player.name': 1, 'player.position': 1 } },
    ];
    
    for (const idxSpec of playersIndexes) {
      const keyString = JSON.stringify(idxSpec.key);
      if (!indexExists(existingPlayersIndexes, keyString)) {
        await playersCollection.createIndex(idxSpec.key, { 
          background: true, 
          unique: idxSpec.unique || false,
          sparse: idxSpec.sparse || false 
        });
        console.log(`  Created index: players.${keyString}`);
      }
    }
    
    // Create matches indexes
    const matchesIndexes = [
      { key: { 'fixture.id': 1 } },
      { key: { 'user.username': 1 } },
      { key: { 'league.season': 1 } },
      { key: { 'location': 1 } },
      { key: { 'teams.home.id': 1 } },
      { key: { 'teams.away.id': 1 } },
      { key: { 'fixture.id': 1, 'user.username': 1 } },
      { key: { 'user.username': 1, 'teams.home.id': 1, 'teams.away.id': 1 } },
      { key: { 'user.username': 1, 'league.season': 1 } },
      { key: { 'user.username': 1, 'location': 1 } },
    ];
    
    for (const idxSpec of matchesIndexes) {
      const keyString = JSON.stringify(idxSpec.key);
      if (!indexExists(existingMatchesIndexes, keyString)) {
        await matchesCollection.createIndex(idxSpec.key, { 
          background: true 
        });
        console.log(`  Created index: matches.${keyString}`);
      }
    }
    
    console.log('✓ All indexes ensured');
    
  } catch (error) {
    console.error('Error ensuring indexes:', error);
    // Continue execution even if index creation fails
  }
};

