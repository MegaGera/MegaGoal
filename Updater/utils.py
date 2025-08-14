import http.client
import json
import datetime
from config import Config

class MatchUpdater:
    """Shared utilities for match updating operations"""
    
    def __init__(self):
        self.db = Config.get_database()
        self.collection_real_matches = self.db['real_matches']
        self.collection_matches = self.db['matches']
        self.collection_settings = self.db['league_settings']
        self.collection_leagues = self.db['leagues']
        self.collection_teams = self.db['teams']
        self.headers = Config.get_api_headers()
        self.url = Config.RAPIDAPI_HOST

    def league_exists(self, league_id):
        """Check if league exists in database"""
        league = self.collection_leagues.find_one({ 'league.id': int(league_id) })
        if league != None:
            return True, league
        else:
            return False, None
        
    def add_leagues_to_db(self, leagues):
        """Add leagues to database"""
        for i in range(len(leagues["response"])):
            exists, league = self.league_exists(leagues["response"][i]["league"]["id"])
            if exists:
                query_filter = { "league.id" : int(league["league"]["id"]) }
                self.collection_leagues.replace_one(query_filter, leagues["response"][i])
            else:
                self.collection_leagues.insert_one(leagues["response"][i])
        
    def get_leagues_from_api(self):
        conn = http.client.HTTPSConnection(self.url)
        endpoint = f"/v3/leagues"
        conn.request("GET", endpoint, headers=self.headers)
        response = conn.getresponse()
        return json.loads(response.read())

    def add_leagues(self):
        """Add leagues to database"""
        leagues = self.get_leagues_from_api()
        self.add_leagues_to_db(leagues)

    def real_match_exists(self, match_id):
        """Check if real_match exists in database"""
        real_match = self.collection_real_matches.find_one({"fixture.id": match_id})
        if real_match is not None:
            return True, real_match
        else:
            return False, None
    
    def real_match_finished(self, real_match):
        """Check if real_match is finished"""
        return real_match["fixture"]["status"]["short"] in Config.get_finished_match_status_array()
    
    def update_real_match(self, match):
        """Update real_match in database"""
        query_filter = {"fixture.id": match["fixture"]["id"]}
        self.collection_real_matches.replace_one(query_filter, match)
    
    def update_matches(self, match):
        """Update matches in database"""
        query_filter = {"fixture.id": match["fixture"]["id"]}
        query_projection = {
            "$set": {
                "goals.home": match["goals"]["home"],
                "goals.away": match["goals"]["away"],
                "status": match["fixture"]["status"]["short"]
            }
        }
        self.collection_matches.update_many(query_filter, query_projection)
    
    def get_matches_from_api(self, league_id, season, date=None, date_to=None):
        """Get matches from API"""
        conn = http.client.HTTPSConnection(self.url)
        season = str(season)
        league_id = str(league_id)
        
        if date:
            if date_to:
                endpoint = f"/v3/fixtures?season={season}&league={league_id}&from={date}&to={date_to}"
                print(f"Getting matches from API for league {league_id}, season {season}, date {date} to {date_to}")
            else:
                endpoint = f"/v3/fixtures?season={season}&league={league_id}&date={date}"
                print(f"Getting matches from API for league {league_id}, season {season}, date {date}")
        else:
            endpoint = f"/v3/fixtures?league={league_id}&season={season}"
            print(f"Getting matches from API for league {league_id}, season {season}")
        
        conn.request("GET", endpoint, headers=self.headers)
        response = conn.getresponse()
        return json.loads(response.read())
    
    def add_real_matches(self, json_real_matches):
        """Add or update real matches in database"""
        for match in json_real_matches["response"]:
            exists, real_match = self.real_match_exists(match["fixture"]["id"])
            if exists:
                if not self.real_match_finished(real_match):
                    self.update_real_match(match)
                    self.update_matches(match)
            else:
                self.collection_real_matches.insert_one(match)
    
    def update_league_last_update(self, league_id):
        """Update last_update field of the league settings"""
        self.collection_settings.update_one(
            {"league_id": int(league_id)}, 
            {"$set": {"last_update": datetime.datetime.today()}}
        )
        self.update_league_next_match(league_id)
    
    def update_league_next_match(self, league_id):
        """Update next_match field of the league settings"""
        now = datetime.datetime.today()
        match = self.collection_real_matches.find(
            {
                "league.id": int(league_id),
                "fixture.timestamp": {"$gte": now.timestamp()}
            },
            {
                "_id": 0,
                "fixture.date": 1,
                "teams.home.name": 1,
                "teams.away.name": 1
            }
        ).sort([("fixture.date", 1)]).limit(1)
        
        match = list(match)
        if match:
            fixture_date_str = match[0]['fixture']['date']
            fixture_date_iso = datetime.datetime.fromisoformat(fixture_date_str.replace("Z", "+00:00"))
            self.collection_settings.update_one(
                {"league_id": int(league_id)}, 
                {"$set": {"next_match": fixture_date_iso}}
            )
        else:
            self.collection_settings.update_one(
                {"league_id": int(league_id)}, 
                {"$set": {"next_match": None}}
            )
    
    def update_league_daily_update(self, league_id):
        """Update last_daily_update in league_settings"""
        self.collection_settings.update_one(
            {"league_id": int(league_id)}, 
            {"$set": {"last_daily_update": datetime.datetime.today()}}
        )
    
    def update_league_matches(self, league_id, season):
        """Fetch matches from API and update DB for a given league and season, and update available_seasons"""
        matches = self.get_matches_from_api(league_id, season)
        self.add_real_matches(matches)
        self.update_league_last_update(league_id)
        
        # Update available_seasons with match count
        match_count = len(matches.get("response", []))
        self.update_available_season_with_matches(league_id, season, match_count)

    def update_available_season_with_matches(self, league_id, season, match_count):
        """Update available_seasons for a league with match count"""
        # Get current available_seasons
        setting = self.collection_settings.find_one({"league_id": int(league_id)})
        if not setting:
            return
        
        available_seasons = setting.get("available_seasons", [])
        
        # Find if season already exists
        season_found = False
        for season_data in available_seasons:
            if season_data.get("season") == season:
                season_data["real_matches"] = match_count if match_count > 0 else None
                season_found = True
                break
        
        # If season not found, add it
        if not season_found:
            available_seasons.append({
                "season": season,
                "real_matches": match_count if match_count > 0 else None,
                "teams": None  # Will be updated when teams are added
            })
        
        # Update the settings
        self.collection_settings.update_one(
            {"league_id": int(league_id)},
            {"$set": {"available_seasons": available_seasons}}
        )

    def update_league_season(self, league_id, season):
        """Update the season field for a league in the settings collection"""
        result = self.collection_settings.update_one(
            {"league_id": int(league_id)},
            {"$set": {"season": int(season)}}
        )
        return result.modified_count

    def check_and_update_available_seasons(self):
        """Check all leagues and update their available_seasons based on existing matches and teams in the database"""
        # Get all league settings
        all_settings = self.collection_settings.find({})
        
        for setting in all_settings:
            league_id = setting["league_id"]
            print(f"Checking league {league_id}")
            
            # Get the corresponding league from collection_leagues
            league = self.collection_leagues.find_one({"league.id": league_id})
            if not league:
                print(f"League {league_id} not found in collection_leagues")
                continue
            
            # Initialize available_seasons array
            available_seasons = []
            
            # Check each season in the league
            for season_data in league.get("seasons", []):
                season = season_data.get("year")
                if not season:
                    continue
                
                print(f"Checking match count for league {league_id} and season {season}")
                # Check if there are any matches for this league and season
                match_count = self.collection_real_matches.count_documents({
                    "league.id": league_id,
                    "league.season": season
                })
                
                print(f"Checking team count for league {league_id} and season {season}")
                # Check if there are any teams for this league and season
                team_count = self.collection_teams.count_documents({
                    "seasons": {
                        "$elemMatch": {
                            "league": str(league_id),
                            "season": str(season)
                        }
                    }
                })
                
                # Add season to available_seasons regardless of counts
                available_seasons.append({
                    "season": season,
                    "real_matches": match_count if match_count > 0 else None,
                    "teams": team_count if team_count > 0 else None
                })

                print(f"Finished checking league {league_id} and season {season}")

            print(f"Finished checking league {league_id}")
            
            # Update the settings with the complete available_seasons array
            self.collection_settings.update_one(
                {"league_id": league_id},
                {"$set": {"available_seasons": available_seasons}}
            )
            
            print(f"Updated available_seasons for league {league_id}: {available_seasons}")

    def team_exists(self, team_id):
        """Check if team exists in database"""
        team = self.collection_teams.find_one({"team.id": team_id})
        if team is not None:
            return True, team
        else:
            return False, None

    def add_season(self, json_team, json_season):
        """Add the season key value of a league to a team if it doesn't have it"""
        if "seasons" in json_team:
            if not dict(json_season) in json_team["seasons"]:
                json_team["seasons"].append(dict(json_season))
            return json_team
        else:
            json_team["seasons"] = [dict(json_season)]
            return json_team

    def add_teams_and_seasons(self, json_teams):
        """Add a list of teams with the season"""
        for i in range(len(json_teams["response"])):
            team_data = json_teams["response"][i]
            team_id = team_data["team"]["id"]
            season_data = json_teams["parameters"]
            
            exists, existing_team = self.team_exists(team_id)
            
            if not exists:
                # Team doesn't exist, insert with season
                team_with_season = self.add_season(team_data, season_data)
                self.collection_teams.insert_one(team_with_season)
                print(f"Inserted new team {team_id} with season {season_data}")
            else:
                # Team exists, update seasons array
                updated_team = self.add_season(existing_team, season_data)
                self.collection_teams.update_one(
                    {"_id": existing_team["_id"]}, 
                    {"$set": {"seasons": updated_team["seasons"]}}
                )
                print(f"Updated existing team {team_id} with season {season_data}")

    def get_teams_from_api(self, league_id, season):
        """Get teams from API"""
        conn = http.client.HTTPSConnection(self.url)
        endpoint = f"/v3/teams?league={league_id}&season={season}"
        print(f"Getting teams from API for league {league_id}, season {season}")
        
        conn.request("GET", endpoint, headers=self.headers)
        response = conn.getresponse()
        return json.loads(response.read())

    def update_teams_by_league_and_season(self, league_id, season):
        """Update teams for a league and season"""
        print(f"Adding the league {league_id} for season {season}")
        teams = self.get_teams_from_api(league_id, season)
        self.add_teams_and_seasons(teams)
        
        # Update available_seasons with team count
        team_count = len(teams.get("response", []))
        self.update_available_season_with_teams(league_id, season, team_count)

    def update_available_season_with_teams(self, league_id, season, team_count):
        """Update available_seasons for a league with team count"""
        # Get current available_seasons
        setting = self.collection_settings.find_one({"league_id": int(league_id)})
        if not setting:
            return
        
        available_seasons = setting.get("available_seasons", [])
        
        # Find if season already exists
        season_found = False
        for season_data in available_seasons:
            if season_data.get("season") == season:
                season_data["teams"] = team_count if team_count > 0 else None
                season_found = True
                break
        
        # If season not found, add it
        if not season_found:
            available_seasons.append({
                "season": season,
                "real_matches": None,  # Will be updated when matches are added
                "teams": team_count if team_count > 0 else None
            })
        
        # Update the settings
        self.collection_settings.update_one(
            {"league_id": int(league_id)},
            {"$set": {"available_seasons": available_seasons}}
        )

    def move_league_position(self, league_id: int, direction: str) -> bool:
        """Move a league's position up or down in the settings collection"""
        # Get all leagues ordered by position
        all_leagues = list(self.collection_settings.find({}).sort("position", 1))
        
        if not all_leagues:
            return False
        
        # Find the current league index
        current_index = None
        for i, league in enumerate(all_leagues):
            if league["league_id"] == league_id:
                current_index = i
                break
        
        if current_index is None:
            return False
        
        # Determine target index based on direction
        if direction == "up" and current_index > 0:
            target_index = current_index - 1
        elif direction == "down" and current_index < len(all_leagues) - 1:
            target_index = current_index + 1
        else:
            return False  # Cannot move in that direction
        
        # Get the leagues to swap
        current_league = all_leagues[current_index]
        target_league = all_leagues[target_index]
        
        # Get current positions
        current_position = current_league.get("position", current_index + 1)
        target_position = target_league.get("position", target_index + 1)
        
        # Swap positions
        self.collection_settings.update_one(
            {"league_id": league_id},
            {"$set": {"position": target_position}}
        )
        
        self.collection_settings.update_one(
            {"league_id": target_league["league_id"]},
            {"$set": {"position": current_position}}
        )
        
        return True

    def change_league_position(self, league_id: int, new_position: int) -> bool:
        """Change a league's position to a specific position and adjust other leagues accordingly"""
        # Get all leagues ordered by position
        all_leagues = list(self.collection_settings.find({}).sort("position", 1))
        
        if not all_leagues:
            return False
        
        # Find the current league
        current_league = None
        current_position = None
        for league in all_leagues:
            if league["league_id"] == league_id:
                current_league = league
                current_position = league.get("position", 1)
                break
        
        if not current_league:
            return False
        
        # If new position is bigger than total leagues, put it at the end
        if new_position > len(all_leagues):
            new_position = len(all_leagues)
        
        # Validate new position
        if new_position < 1:
            return False
        
        # If the new position is the same as current, no change needed
        if new_position == current_position:
            return True

        # Check if the target position is already occupied by another league
        target_position_occupied = False
        for league in all_leagues:
            if league["league_id"] != league_id and league.get("position") == new_position:
                target_position_occupied = True
                break
        
        # Update the target league to the new position
        self.collection_settings.update_one(
            {"league_id": league_id},
            {"$set": {"position": new_position}}
        )

        if not target_position_occupied:
            return True

        # Adjust positions of other leagues (only if there are conflicts)
        if new_position > current_position:
            # Moving down: shift leagues between current and new position up by 1
            for league in all_leagues:
                if league["league_id"] != league_id:
                    pos = league.get("position", 1)
                    if current_position < pos <= new_position:
                        self.collection_settings.update_one(
                            {"league_id": league["league_id"]},
                            {"$set": {"position": pos - 1}}
                        )
        else:
            # Moving up: shift leagues between new and current position down by 1
            for league in all_leagues:
                if league["league_id"] != league_id:
                    pos = league.get("position", 1)
                    if new_position <= pos < current_position:
                        self.collection_settings.update_one(
                            {"league_id": league["league_id"]},
                            {"$set": {"position": pos + 1}}
                        )
        
        return True