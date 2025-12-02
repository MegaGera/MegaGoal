import http.client
import json
import datetime
from ..config import Config

class PlayersUpdater:
    """Utilities for player updating operations"""
    
    def __init__(self):
        self.db = Config.get_database()
        self.collection_players = self.db['players']
        self.collection_settings = self.db['settings']
        self.headers = Config.get_api_headers()
        self.url = Config.RAPIDAPI_HOST

    def player_exists(self, player_id):
        """Check if player exists in database"""
        player = self.collection_players.find_one({"player.id": player_id})
        if player is not None:
            return True, player
        else:
            return False, None

    def get_players_from_api_by_page(self, page):
        """Get players from API with pagination"""
        conn = http.client.HTTPSConnection(self.url)
        endpoint = f"/players/profiles?page={page}"
        print(f"Getting players from API for page {page}")
        
        conn.request("GET", endpoint, headers=self.headers)
        response = conn.getresponse()
        return json.loads(response.read())

    def add_team_to_player(self, player_data, team_info, season):
        """Add team information to a player's teams array"""
        if "teams" not in player_data:
            player_data["teams"] = []
        
        # Check if team already exists in player's teams
        team_found = False
        for team_data in player_data["teams"]:
            if team_data["team"]["id"] == team_info["team"]["id"]:
                # Team exists, add season if not already present
                if season not in team_data["seasons"]:
                    team_data["seasons"].append(season)
                team_found = True
                break
        
        # If team doesn't exist, add it
        if not team_found:
            player_data["teams"].append({
                "team": team_info["team"],
                "seasons": [season]
            })
        
        return player_data

    def get_players_from_api_by_league_and_season(self, league_id, season, page=1):
        """Get players from API for a specific league and season"""
        conn = http.client.HTTPSConnection(self.url)
        endpoint = f"/players?league={league_id}&season={season}&page={page}"
        print(f"Getting players from API for league {league_id}, season {season}, page {page}")
        
        conn.request("GET", endpoint, headers=self.headers)
        response = conn.getresponse()
        return json.loads(response.read())

    def add_players_to_db(self, players_data):
        """Add or update players in database"""
        for player in players_data["response"]:
            player_id = player["player"]["id"]
            exists, existing_player = self.player_exists(player_id)
            
            if exists:
                # Update existing player
                query_filter = {"player.id": player_id}
                self.collection_players.replace_one(query_filter, player)
                print(f"Updated existing player {player_id}")
            else:
                # Insert new player
                self.collection_players.insert_one(player)
                print(f"Inserted new player {player_id}")

    def update_players_api_info(self, current_page, total_pages):
        """Update or create PLAYERS_API_INFO document in settings collection"""
        query_filter = {"type": "PLAYERS_API_INFO"}
        
        # Get existing document
        existing_doc = self.collection_settings.find_one(query_filter)
        
        if existing_doc:
            # Update existing document
            pages_searched = existing_doc.get("pages_searched", [])
            if current_page not in pages_searched:
                pages_searched.append(current_page)
                pages_searched.sort()
            
            update_doc = {
                "$set": {
                    "pages_searched": pages_searched,
                    "total_pages": total_pages,
                    "last_update": datetime.datetime.today()
                }
            }
        else:
            # Create new document
            update_doc = {
                "$set": {
                    "type": "PLAYERS_API_INFO",
                    "pages_searched": [current_page],
                    "total_pages": total_pages,
                    "last_update": datetime.datetime.today()
                }
            }
        
        self.collection_settings.update_one(query_filter, update_doc, upsert=True)
        print(f"Updated PLAYERS_API_INFO: page {current_page} of {total_pages}")

    def update_players_by_page(self, page):
        """Update players for a specific page"""
        print(f"Updating players for page {page}")
        players_data = self.get_players_from_api_by_page(page)
        
        # Add players to database
        self.add_players_to_db(players_data)
        
        # Update API info
        current_page = players_data.get("paging", {}).get("current", page)
        total_pages = players_data.get("paging", {}).get("total", 1)
        self.update_players_api_info(current_page, total_pages)
        
        return {
            "status": "success",
            "message": f"Updated players for page {page}",
            "players_added": len(players_data.get("response", [])),
            "current_page": current_page,
            "total_pages": total_pages
        }

    def get_player_teams_from_api(self, player_id):
        """Get player teams from API"""
        conn = http.client.HTTPSConnection(self.url)
        endpoint = f"/players/teams?player={player_id}"
        print(f"Getting teams from API for player {player_id}")
        
        conn.request("GET", endpoint, headers=self.headers)
        response = conn.getresponse()
        return json.loads(response.read())

    def update_player_teams(self, player_id):
        """Update teams information for a specific player"""
        print(f"Updating teams for player {player_id}")
        
        # Get teams from API
        teams_data = self.get_player_teams_from_api(player_id)
        teams_response = teams_data.get("response", [])
        
        # Update player document with teams information
        query_filter = {"player.id": int(player_id)}
        update_doc = {"$set": {"teams": teams_response, "last_update": datetime.datetime.now()}}
        result = self.collection_players.update_one(query_filter, update_doc)
        
        if result.matched_count == 0:
            print(f"No player found with ID {player_id} to update teams")
            return False
        
        print(f"Updated teams for player {player_id}")
        return True
