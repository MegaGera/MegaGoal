import { getDB } from '../config/db.js';

// Get players from database with search and pagination
export const getPlayers = async (req, res) => {
  try {
    const db = getDB();
    
    // Get query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const position = req.query.position || '';
    const nationality = req.query.nationality || '';
    const teamsFilter = req.query.teams_filter || '';
    
    // Calculate skip value for pagination
    const skip = (page - 1) * limit;
    
    // Build search filter
    let filter = {};
    
    // Name search
    if (search.trim()) {
      filter['player.name'] = { $regex: search.trim(), $options: 'i' };
    }
    
    // Position filter
    if (position.trim()) {
      filter['player.position'] = position.trim();
    }
    
    // Nationality filter
    if (nationality.trim()) {
      filter['player.nationality'] = nationality.trim();
    }
    
    // Teams filter
    if (teamsFilter === 'with-teams') {
      filter['teams'] = { $exists: true, $ne: [], $not: { $size: 0 } };
    } else if (teamsFilter === 'without-teams') {
      filter['$or'] = [
        { 'teams': { $exists: false } },
        { 'teams': { $size: 0 } },
        { 'teams': null }
      ];
    }
    
    // Get total count for pagination info
    const totalCount = await db.collection('players').countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limit);
    
    // Get players with pagination
    const players = await db.collection('players')
      .find(filter)
      .sort({ 'player.id': 1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    res.json({
      players,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
};

// Get players API info from settings
export const getPlayersApiInfo = async (req, res) => {
  try {
    const db = getDB();
    const apiInfo = await db.collection('settings').findOne({ type: 'PLAYERS_API_INFO' });
    
    if (!apiInfo) {
      return res.json({
        type: 'PLAYERS_API_INFO',
        pages_searched: [],
        total_pages: 0,
        last_update: null
      });
    }
    
    res.json(apiInfo);
  } catch (error) {
    console.error('Error fetching players API info:', error);
    res.status(500).json({ error: 'Failed to fetch players API info' });
  }
};
