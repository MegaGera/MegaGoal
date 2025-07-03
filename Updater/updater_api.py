from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from utils import MatchUpdater

app = FastAPI()

# Allow all origins for now; restrict in production as needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UpdateRequest(BaseModel):
    league_id: int
    season: int

@app.post("/update_matches/")
def update_matches(req: UpdateRequest):
    updater = MatchUpdater()
    try:
        updater.update_league_matches(req.league_id, req.season)
        return {"status": "success", "message": f"Updated matches for league {req.league_id} in season {req.season}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update_league_current_season/")
def update_league_season(req: UpdateRequest):
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
def update_leagues():
    updater = MatchUpdater()
    try:
        updater.add_leagues()
        return {"status": "success", "message": "Leagues updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))