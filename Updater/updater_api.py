from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import httpx
from utils import MatchUpdater

app = FastAPI()

# CORS configuration - matching the Node.js server approach
if os.getenv('NODE_ENV') == 'production':
    print("Production mode - cors")
    
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r".*\.megagera\.com$",
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        max_age=86400,  # Cache preflight for 24 hours
    )
else:
    # Normal use in development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

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

@app.post("/update_matches/")
async def update_matches(req: UpdateRequest, request: Request):
    await validate_admin(request)
    updater = MatchUpdater()
    try:
        updater.update_league_matches(req.league_id, req.season)
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

@app.post("/check_available_seasons/")
async def check_available_seasons(request: Request):
    await validate_admin(request)
    updater = MatchUpdater()
    try:
        updater.check_and_update_available_seasons()
        return {"status": "success", "message": "Available seasons checked and updated for all leagues"}
    except Exception as e:
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