import http.client
import json
import datetime
from config import Config

class StatisticsUpdater:
    """Utilities for statistics updating operations"""
    
    def __init__(self):
        self.db = Config.get_database()
        self.collection_real_matches = self.db['real_matches']
        self.collection_settings = self.db['league_settings']
        self.headers = Config.get_api_headers()
        self.url = Config.RAPIDAPI_HOST

    def get_fixture_statistics_from_api(self, fixture_id: int):
        """Fetch fixture statistics from external API (API-SPORTS)"""
        conn = http.client.HTTPSConnection(self.url)
        endpoint = f"/fixtures/statistics?fixture={fixture_id}"
        print(f"Getting statistics from API for fixture {fixture_id}")
        conn.request("GET", endpoint, headers=self.headers)
        response = conn.getresponse()
        return json.loads(response.read())

    def update_match_statistics(self, fixture_id: int):
        """Fetch and persist statistics for a given fixture into real_matches document"""
        # Get stats from API
        stats_json = self.get_fixture_statistics_from_api(fixture_id)
        stats_response = stats_json.get("response", [])

        # Upsert statistics field into real_matches
        query_filter = {"fixture.id": int(fixture_id)}
        update_doc = {"$set": {"statistics": stats_response}}
        result = self.collection_real_matches.update_one(query_filter, update_doc)

        # If the real_match document does not exist, do nothing more
        if result.matched_count == 0:
            print(f"No real_match found for fixture {fixture_id} to update statistics")
            return False

        print(f"Updated statistics for fixture {fixture_id}")
        return True

    def update_statistics_by_league_and_season(self, league_id, season):
        """Update statistics for all finished matches in a league and season"""
        print(f"Updating statistics for league {league_id}, season {season}")
        
        # Get finished matches for this league and season
        finished_statuses = Config.get_finished_match_status_array()
        matches = self.collection_real_matches.find({
            "league.id": int(league_id),
            "league.season": int(season),
            "fixture.status.short": {"$in": finished_statuses}
        })
        
        total_statistics = 0
        matches_list = list(matches)
        
        for match in matches_list:
            fixture_id = match["fixture"]["id"]
            
            # Update statistics for this match
            success = self.update_match_statistics(fixture_id)
            if success:
                total_statistics += 1
                print(f"Updated statistics for fixture {fixture_id}")
        
        print(f"Updated {total_statistics} statistics for league {league_id}, season {season}")
        
        # Update available_seasons with statistics count
        self.update_available_season_with_statistics(league_id, season, total_statistics)
        
        return total_statistics

    def update_available_season_with_statistics(self, league_id, season, statistics_count):
        """Update available_seasons for a league with statistics count"""
        # Get current available_seasons
        setting = self.collection_settings.find_one({"league_id": int(league_id)})
        if not setting:
            return
        
        available_seasons = setting.get("available_seasons", [])
        
        # Find if season already exists
        season_found = False
        for season_data in available_seasons:
            if season_data.get("season") == season:
                season_data["statistics"] = statistics_count if statistics_count > 0 else None
                season_found = True
                break
        
        # Only update if season exists in available_seasons
        if season_found:
            # Update the settings
            self.collection_settings.update_one(
                {"league_id": int(league_id)},
                {"$set": {"available_seasons": available_seasons}}
            )
            print(f"Updated statistics_count for league {league_id}, season {season}: {statistics_count}")
        else:
            print(f"Season {season} not found in available_seasons for league {league_id}, skipping statistics update")
