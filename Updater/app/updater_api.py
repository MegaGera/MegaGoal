from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import httpx
import logging
from .utils import MatchUpdater
from .players import PlayersUpdater
from .lineups import LineupsUpdater
from .events import EventsUpdater
from .statistics import StatisticsUpdater

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Debug logging
logger.info(f"Starting FastAPI app with NODE_ENV: {os.getenv('NODE_ENV')}")

# CORS configuration - matching the Node.js server approach
if os.getenv('NODE_ENV') == 'production':
    logger.info("Production mode - cors")
    logger.info("Setting up CORS for megagera.com domains")
    
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r".*\.megagera\.com$",
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        max_age=86400,  # Cache preflight for 24 hours
    )
else:
    logger.info("Development mode - cors")
    logger.info("Setting up CORS for all origins")
    # Normal use in development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

logger.info("CORS middleware configured successfully")

# Admin validation middleware
async def validate_admin(request: Request):
    """Validate admin permissions from megaauth service"""
    # Skip validation in development mode
    if os.getenv('NODE_ENV') == 'development':
        return request
    
    # Get the access token from cookies
    access_token = request.cookies.get('access_token')
    if not access_token:
        raise HTTPException(status_code=401, detail="Access token required")
    
    # Validate admin permissions with megaauth service
    validate_uri_admin = os.getenv('VALIDATE_URI_ADMIN')
    if not validate_uri_admin:
        raise HTTPException(status_code=500, detail="VALIDATE_URI_ADMIN not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            headers = {'Cookie': f'access_token={access_token}'}
            response = await client.get(validate_uri_admin, headers=headers)
            
            if response.status_code != 200:
                raise HTTPException(status_code=403, detail="Admin access required")
            
            data = response.json()
            request.state.validate_data = data.get('data', {})
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=401, detail=f"Authentication server request failed: {str(e)}")

    return request

class UpdateRequest(BaseModel):
    league_id: int
    season: int

class MovePositionRequest(BaseModel):
    league_id: int
    direction: str

class ChangePositionRequest(BaseModel):
    league_id: int
    new_position: int

class UpdateStatisticsRequest(BaseModel):
    fixture_id: int

class UpdatePlayersRequest(BaseModel):
    page: int

class UpdatePlayerTeamsRequest(BaseModel):
    player_id: int

class UpdateLeaguePlayersRequest(BaseModel):
    league_id: int
    season: int

class UpdateLeagueLineupsRequest(BaseModel):
    league_id: int
    season: int

class UpdateLeagueEventsRequest(BaseModel):
    league_id: int
    season: int

class UpdateLeagueStatisticsRequest(BaseModel):
    league_id: int
    season: int

class MultiSeasonUpdateRequest(BaseModel):
    league_id: int
    season_from: int
    season_to: int
    update_matches: bool = False
    update_teams: bool = False
    update_players: bool = False
    update_statistics: bool = False
    update_statistics_missing: bool = False
    update_lineups: bool = False
    update_lineups_missing: bool = False
    update_events: bool = False
    update_events_missing: bool = False

@app.get("/health/")
async def health_check():
    """Health check endpoint for debugging"""
    logger.info("Health check endpoint called")
    return {
        "status": "healthy", 
        "node_env": os.getenv('NODE_ENV'),
        "cors_configured": True
    }

@app.options("/check_available_seasons/")
async def check_available_seasons_options():
    """Handle OPTIONS preflight for check_available_seasons"""
    logger.info("OPTIONS preflight request received for check_available_seasons")
    return {"status": "ok"}

@app.post("/update_matches/")
async def update_matches(req: UpdateRequest, request: Request):
    await validate_admin(request)
    updater = MatchUpdater()
    try:
        updater.update_league_matches(req.league_id, req.season, full=False)
        return {"status": "success", "message": f"Updated matches for league {req.league_id} in season {req.season}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update_league_current_season/")
async def update_league_season(req: UpdateRequest, request: Request):
    await validate_admin(request)
    updater = MatchUpdater()
    try:
        modified = updater.update_league_season(req.league_id, req.season)
        if modified:
            return {"status": "success", "message": f"Season updated for league {req.league_id} to {req.season}"}
        else:
            return {"status": "not_modified", "message": f"No document updated for league {req.league_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 

@app.post("/update_leagues/")
async def update_leagues(request: Request):
    await validate_admin(request)
    updater = MatchUpdater()
    try:
        updater.add_leagues()
        return {"status": "success", "message": "Leagues updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update_match_statistics/")
async def update_match_statistics(req: UpdateStatisticsRequest, request: Request):
    await validate_admin(request)
    updater = StatisticsUpdater()
    try:
        success = updater.update_match_statistics(req.fixture_id)
        if success:
            return {"status": "success", "message": f"Updated statistics for fixture {req.fixture_id}"}
        else:
            return {"status": "not_found", "message": f"No real_match found for fixture {req.fixture_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update_match_lineups/")
async def update_match_lineups(req: UpdateStatisticsRequest, request: Request):
    await validate_admin(request)
    updater = LineupsUpdater()
    try:
        success = updater.update_match_lineups(req.fixture_id)
        if success:
            return {"status": "success", "message": f"Updated lineups for fixture {req.fixture_id}"}
        else:
            return {"status": "not_found", "message": f"No real_match found for fixture {req.fixture_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update_match_events/")
async def update_match_events(req: UpdateStatisticsRequest, request: Request):
    await validate_admin(request)
    updater = EventsUpdater()
    try:
        success = updater.update_match_events(req.fixture_id)
        if success:
            return {"status": "success", "message": f"Updated events for fixture {req.fixture_id}"}
        else:
            return {"status": "not_found", "message": f"No real_match found for fixture {req.fixture_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/check_available_seasons/")
async def check_available_seasons(request: Request):
    logger.info("POST request received for check_available_seasons")
    await validate_admin(request)
    updater = MatchUpdater()
    try:
        updater.check_and_update_available_seasons()
        return {"status": "success", "message": "Available seasons checked and updated for all leagues"}
    except Exception as e:
        logger.error(f"Error in check_available_seasons: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update_teams/")
async def update_teams(req: UpdateRequest, request: Request):
    await validate_admin(request)
    updater = MatchUpdater()
    try:
        updater.update_teams_by_league_and_season(req.league_id, req.season)
        return {"status": "success", "message": f"Updated teams for league {req.league_id} in season {req.season}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/move_league_position/")
async def move_league_position(req: MovePositionRequest, request: Request):
    await validate_admin(request)
    updater = MatchUpdater()
    try:
        success = updater.move_league_position(req.league_id, req.direction)
        if success:
            return {"status": "success", "message": f"Moved league {req.league_id} {req.direction}"}
        else:
            return {"status": "error", "message": f"Cannot move league {req.league_id} {req.direction}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/change_league_position/")
async def change_league_position(req: ChangePositionRequest, request: Request):
    await validate_admin(request)
    updater = MatchUpdater()
    try:
        success = updater.change_league_position(req.league_id, req.new_position)
        if success:
            return {"status": "success", "message": f"Changed league {req.league_id} to position {req.new_position}"}
        else:
            return {"status": "error", "message": f"Cannot change league {req.league_id} to position {req.new_position}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update_players/")
async def update_players(req: UpdatePlayersRequest, request: Request):
    await validate_admin(request)
    updater = PlayersUpdater()
    try:
        result = updater.update_players_by_page(req.page)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update_player_teams/")
async def update_player_teams(req: UpdatePlayerTeamsRequest, request: Request):
    await validate_admin(request)
    updater = PlayersUpdater()
    try:
        success = updater.update_player_teams(req.player_id)
        if success:
            return {"status": "success", "message": f"Updated teams for player {req.player_id}"}
        else:
            return {"status": "error", "message": f"Player {req.player_id} not found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update_league_players/")
async def update_league_players(req: UpdateLeaguePlayersRequest, request: Request):
    await validate_admin(request)
    updater = PlayersUpdater()
    try:
        player_count = updater.update_players_by_league_and_season(req.league_id, req.season)
        return {
            "status": "success", 
            "message": f"Updated {player_count} players for league {req.league_id}, season {req.season}",
            "players_count": player_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update_league_lineups/")
async def update_league_lineups(req: UpdateLeagueLineupsRequest, request: Request):
    await validate_admin(request)
    updater = LineupsUpdater()
    try:
        lineup_count = updater.update_lineups_by_league_and_season_full(req.league_id, req.season)
        return {
            "status": "success", 
            "message": f"Updated {lineup_count} lineups for league {req.league_id}, season {req.season}",
            "lineups_count": lineup_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update_league_lineups_missing/")
async def update_league_lineups_missing(req: UpdateLeagueLineupsRequest, request: Request):
    await validate_admin(request)
    updater = LineupsUpdater()
    try:
        lineup_count = updater.update_lineups_by_league_and_season_missing(req.league_id, req.season)
        return {
            "status": "success", 
            "message": f"Updated {lineup_count} missing lineups for league {req.league_id}, season {req.season}",
            "lineups_count": lineup_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update_league_events/")
async def update_league_events(req: UpdateLeagueEventsRequest, request: Request):
    await validate_admin(request)
    updater = EventsUpdater()
    try:
        events_count = updater.update_events_by_league_and_season_full(req.league_id, req.season)
        return {
            "status": "success", 
            "message": f"Updated {events_count} events for league {req.league_id}, season {req.season}",
            "events_count": events_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update_league_events_missing/")
async def update_league_events_missing(req: UpdateLeagueEventsRequest, request: Request):
    await validate_admin(request)
    updater = EventsUpdater()
    try:
        events_count = updater.update_events_by_league_and_season_missing(req.league_id, req.season)
        return {
            "status": "success", 
            "message": f"Updated {events_count} missing events for league {req.league_id}, season {req.season}",
            "events_count": events_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update_league_statistics/")
async def update_league_statistics(req: UpdateLeagueStatisticsRequest, request: Request):
    await validate_admin(request)
    updater = StatisticsUpdater()
    try:
        statistics_count = updater.update_statistics_by_league_and_season_full(req.league_id, req.season)
        return {
            "status": "success", 
            "message": f"Updated {statistics_count} statistics for league {req.league_id}, season {req.season}",
            "statistics_count": statistics_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update_league_statistics_missing/")
async def update_league_statistics_missing(req: UpdateLeagueStatisticsRequest, request: Request):
    await validate_admin(request)
    updater = StatisticsUpdater()
    try:
        statistics_count = updater.update_statistics_by_league_and_season_missing(req.league_id, req.season)
        return {
            "status": "success", 
            "message": f"Updated {statistics_count} missing statistics for league {req.league_id}, season {req.season}",
            "statistics_count": statistics_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/multi_season_update/")
async def multi_season_update(req: MultiSeasonUpdateRequest, request: Request):
    await validate_admin(request)
    
    logger.info(f"Starting multi-season update for league {req.league_id} from season {req.season_from} to {req.season_to}")
    logger.info(f"Update options: matches={req.update_matches}, teams={req.update_teams}, players={req.update_players}, statistics={req.update_statistics}, statistics_missing={req.update_statistics_missing}, lineups={req.update_lineups}, lineups_missing={req.update_lineups_missing}, events={req.update_events}, events_missing={req.update_events_missing}")
    
    results = {
        "league_id": req.league_id,
        "season_from": req.season_from,
        "season_to": req.season_to,
        "seasons_processed": [],
        "total_updates": {
            "matches": 0,
            "teams": 0,
            "players": 0,
            "statistics": 0,
            "statistics_missing": 0,
            "lineups": 0,
            "lineups_missing": 0,
            "events": 0,
            "events_missing": 0
        }
    }
    
    try:
        # Process each season from season_from to season_to
        for season in range(req.season_from, req.season_to + 1):
            season_result = {"season": season, "updates": {}}
            
            # Update matches
            if req.update_matches:
                updater = MatchUpdater()
                updater.update_league_matches(req.league_id, season, full=False)
                season_result["updates"]["matches"] = "completed"
                results["total_updates"]["matches"] += 1
            
            # Update teams
            if req.update_teams:
                updater = MatchUpdater()
                updater.update_teams_by_league_and_season(req.league_id, season)
                season_result["updates"]["teams"] = "completed"
                results["total_updates"]["teams"] += 1
            
            # Update players
            if req.update_players:
                updater = PlayersUpdater()
                updater.update_players_by_league_and_season(req.league_id, season)
                season_result["updates"]["players"] = "completed"
                results["total_updates"]["players"] += 1
            
            # Update statistics (full)
            if req.update_statistics:
                updater = StatisticsUpdater()
                updater.update_statistics_by_league_and_season_full(req.league_id, season)
                season_result["updates"]["statistics"] = "completed"
                results["total_updates"]["statistics"] += 1
            
            # Update statistics (missing only)
            if req.update_statistics_missing:
                updater = StatisticsUpdater()
                updater.update_statistics_by_league_and_season_missing(req.league_id, season)
                season_result["updates"]["statistics_missing"] = "completed"
                results["total_updates"]["statistics_missing"] += 1
            
            # Update lineups (full)
            if req.update_lineups:
                updater = LineupsUpdater()
                updater.update_lineups_by_league_and_season_full(req.league_id, season)
                season_result["updates"]["lineups"] = "completed"
                results["total_updates"]["lineups"] += 1
            
            # Update lineups (missing only)
            if req.update_lineups_missing:
                updater = LineupsUpdater()
                updater.update_lineups_by_league_and_season_missing(req.league_id, season)
                season_result["updates"]["lineups_missing"] = "completed"
                results["total_updates"]["lineups_missing"] += 1
            
            # Update events (full)
            if req.update_events:
                updater = EventsUpdater()
                updater.update_events_by_league_and_season_full(req.league_id, season)
                season_result["updates"]["events"] = "completed"
                results["total_updates"]["events"] += 1
            
            # Update events (missing only)
            if req.update_events_missing:
                updater = EventsUpdater()
                updater.update_events_by_league_and_season_missing(req.league_id, season)
                season_result["updates"]["events_missing"] = "completed"
                results["total_updates"]["events_missing"] += 1
            
            results["seasons_processed"].append(season_result)
            logger.info(f"Season {season} processing completed for league {req.league_id}")
        
        logger.info(f"Multi-season update completed successfully for league {req.league_id}")
        logger.info(f"Total updates performed: {results['total_updates']}")
        
        return {
            "status": "success",
            "message": f"Multi-season update completed for league {req.league_id} from season {req.season_from} to {req.season_to}",
            "results": results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))