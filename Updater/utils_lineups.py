import http.client
import json
import datetime
from config import Config

class LineupsUpdater:
    """Utilities for lineups updating operations"""
    
    def __init__(self):
        self.db = Config.get_database()
        self.collection_real_matches = self.db['real_matches']
        self.collection_settings = self.db['league_settings']
        self.headers = Config.get_api_headers()
        self.url = Config.RAPIDAPI_HOST

    def get_fixture_lineups_from_api(self, fixture_id: int):
        """Fetch fixture lineups from external API"""
        conn = http.client.HTTPSConnection(self.url)
        endpoint = f"/fixtures/lineups?fixture={fixture_id}"
        print(f"Getting lineups from API for fixture {fixture_id}")
        
        conn.request("GET", endpoint, headers=self.headers)
        response = conn.getresponse()
        return json.loads(response.read())

    def update_lineups_by_league_and_season(self, league_id, season):
        """Update lineups for all finished matches in a league and season"""
        print(f"Updating lineups for league {league_id}, season {season}")
        
        # Get finished matches for this league and season
        finished_statuses = Config.get_finished_match_status_array()
        matches = self.collection_real_matches.find({
            "league.id": int(league_id),
            "league.season": int(season),
            "fixture.status.short": {"$in": finished_statuses}
        })
        
        total_lineups = 0
        matches_list = list(matches)
        
        for match in matches_list:
            fixture_id = match["fixture"]["id"]
            
            # Get lineups from API
            lineups_data = self.get_fixture_lineups_from_api(fixture_id)
            lineups_response = lineups_data.get("response", [])
            
            if lineups_response:
                # Update match with lineups
                query_filter = {"fixture.id": int(fixture_id)}
                update_doc = {"$set": {"lineups": lineups_response}}
                self.collection_real_matches.update_one(query_filter, update_doc)

                total_lineups += len(lineups_response)
                print(f"Updated lineups for fixture {fixture_id}")
        
        print(f"Updated {total_lineups} lineups for league {league_id}, season {season}")
        
        # Update available_seasons with lineups count
        self.update_available_season_with_lineups(league_id, season, total_lineups)
        
        return total_lineups

    def update_available_season_with_lineups(self, league_id, season, lineups_count):
        """Update available_seasons for a league with lineups count"""
        # Get current available_seasons
        setting = self.collection_settings.find_one({"league_id": int(league_id)})
        if not setting:
            return
        
        available_seasons = setting.get("available_seasons", [])
        
        # Find if season already exists
        season_found = False
        for season_data in available_seasons:
            if season_data.get("season") == season:
                season_data["lineups"] = lineups_count if lineups_count > 0 else None
                season_found = True
                break
        
        # Only update if season exists in available_seasons
        if season_found:
            # Update the settings
            self.collection_settings.update_one(
                {"league_id": int(league_id)},
                {"$set": {"available_seasons": available_seasons}}
            )
            print(f"Updated lineups_count for league {league_id}, season {season}: {lineups_count}")
        else:
            print(f"Season {season} not found in available_seasons for league {league_id}, skipping lineups update")
