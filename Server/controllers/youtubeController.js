/*
  YouTube Controller
  Handles YouTube API requests to search for match highlights
*/

const searchMatchHighlights = async (req, res) => {
  try {
    const { homeTeam, awayTeam, homeScore, awayScore, date } = req.query;

    // Validate required parameters
    if (!homeTeam || !awayTeam) {
      return res.status(400).json({ 
        error: 'Missing required parameters: homeTeam and awayTeam are required' 
      });
    }

    // Get YouTube API key from environment
    const apiKey = process.env.YT_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'YouTube API key not configured' 
      });
    }

    // Build search query
    let searchQuery = `${homeTeam} vs ${awayTeam}`;
    
    // Add score if available
    if (homeScore !== undefined && awayScore !== undefined) {
      searchQuery += ` ${homeScore}-${awayScore}`;
    }
    
    // Add date if available (format: YYYY-MM-DD)
    if (date) {
      const dateObj = new Date(date);
      const formattedDate = dateObj.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      searchQuery += ` ${formattedDate}`;
    }
    
    // Add keywords for highlights
    searchQuery += ' highlights';

    // YouTube Data API v3 search endpoint
    const youtubeUrl = 'https://www.googleapis.com/youtube/v3/search';
    const params = new URLSearchParams({
      part: 'snippet',
      q: searchQuery,
      type: 'video',
      maxResults: '1',
      order: 'relevance',
      key: apiKey
    });

    const response = await fetch(`${youtubeUrl}?${params.toString()}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('YouTube API error:', errorData);
      return res.status(response.status).json({ 
        error: 'Failed to fetch from YouTube API',
        details: errorData 
      });
    }

    const data = await response.json();

    // Extract video information
    if (data.items && data.items.length > 0) {
      const video = data.items[0];
      const videoId = video.id.videoId;
      
      // Get origin from request headers for proper Referer identification
      // This is required by YouTube API to avoid Error 153
      // YouTube requires the origin parameter to match the domain embedding the player
      let originDomain = 'https://megagoal.megagera.com'; // Default fallback
      
      if (req.headers.origin) {
        try {
          const originUrl = new URL(req.headers.origin);
          originDomain = originUrl.origin;
        } catch (e) {
          // If origin is not a valid URL, use default
        }
      } else if (req.headers.referer) {
        try {
          const refererUrl = new URL(req.headers.referer);
          originDomain = refererUrl.origin;
        } catch (e) {
          // If referer is not a valid URL, use default
        }
      }
      
      // Build embed URL with origin parameter (required for Error 153 fix)
      // The origin parameter is required by YouTube API to identify the embedding site
      const embedUrl = `https://www.youtube.com/embed/${videoId}?origin=${encodeURIComponent(originDomain)}`;
      
      const videoTitle = video.snippet.title;
      const videoThumbnail = video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url;
      const channelTitle = video.snippet.channelTitle;
      const publishedAt = video.snippet.publishedAt;

      res.json({
        videoId,
        title: videoTitle,
        thumbnail: videoThumbnail,
        channelTitle,
        publishedAt,
        embedUrl: embedUrl,
        watchUrl: `https://www.youtube.com/watch?v=${videoId}`
      });
    } else {
      res.json({
        videoId: null,
        message: 'No highlights video found for this match'
      });
    }
  } catch (error) {
    console.error('Error searching YouTube:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};

export { searchMatchHighlights };

