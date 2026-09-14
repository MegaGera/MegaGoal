import { searchGlobal } from '../services/globalSearchService.js';

/**
 * GET /search?q=
 * Unified top-menu search: watched teams/players/leagues + catalog fill.
 */
export const search = async (req, res) => {
  try {
    const username = req.validateData?.username;
    if (!username) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const q = req.query.q ?? req.query.query ?? req.query.search ?? '';
    const result = await searchGlobal({
      username,
      query: q,
      limit: req.query.limit,
    });

    const query = String(q).trim();
    console.log(
      `Global search "${query || '(top watched)'}": ${result.items.length}`
    );
    res.json(result);
  } catch (error) {
    console.error('Error in global search:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
};
