import http.client
import json
from config import Config

class EventsUpdater:
    """Utilities for events updating operations"""
    
    def __init__(self):
        self.db = Config.get_database()
        self.collection_real_matches = self.db['real_matches']
        self.collection_settings = self.db['league_settings']
        self.headers = Config.get_api_headers()
        self.url = Config.RAPIDAPI_HOST
        self.data_field = "events"
        self.data_type = "events"

    def _get_data_from_api(self, fixture_id: int):
        """Fetch fixture events from external API"""
        conn = http.client.HTTPSConnection(self.url)
        endpoint = f"/fixtures/{self.data_type}?fixture={fixture_id}"
        print(f"Getting {self.data_type} from API for fixture {fixture_id}")
        conn.request("GET", endpoint, headers=self.headers)
        response = conn.getresponse()
        return json.loads(response.read())

    def get_fixture_events_from_api(self, fixture_id: int):
        """Fetch fixture events from external API (public alias)"""
        return self._get_data_from_api(fixture_id)

    def update_match_events(self, fixture_id: int):
        """Fetch and persist events for a given fixture into real_matches document"""
        data_json = self._get_data_from_api(fixture_id)
        data_response = data_json.get("response", [])

        # Upsert events field into real_matches
        query_filter = {"fixture.id": int(fixture_id)}
        update_doc = {"$set": {self.data_field: data_response}}
        result = self.collection_real_matches.update_one(query_filter, update_doc)

        if result.matched_count == 0:
            print(f"No real_match found for fixture {fixture_id} to update {self.data_type}")
            return False

        print(f"Updated {self.data_type} for fixture {fixture_id}")
        return True

    def _count_matches_with_data(self, league_id, season):
        """Count finished matches that have events data"""
        finished_statuses = Config.get_finished_match_status_array()
        count = self.collection_real_matches.count_documents({
            "league.id": int(league_id),
            "league.season": int(season),
            "fixture.status.short": {"$in": finished_statuses},
            self.data_field: {"$exists": True, "$ne": None, "$ne": []}
        })
        return count

    def _update_matches(self, matches_list, update_type="full"):
        """Update matches from the provided list"""
        updated_count = 0
        
        for match in matches_list:
            fixture_id = match["fixture"]["id"]
            data_json = self._get_data_from_api(fixture_id)
            data_response = data_json.get("response", [])
            
            if data_response:
                query_filter = {"fixture.id": int(fixture_id)}
                update_doc = {"$set": {self.data_field: data_response}}
                self.collection_real_matches.update_one(query_filter, update_doc)
                updated_count += 1
                print(f"Updated {self.data_type} for fixture {fixture_id}")
        
        return updated_count

    def update_events_by_league_and_season_full(self, league_id, season):
        """Update events for all finished matches in a league and season"""
        print(f"Updating {self.data_type} (full) for league {league_id}, season {season}")
        
        finished_statuses = Config.get_finished_match_status_array()
        matches = self.collection_real_matches.find({
            "league.id": int(league_id),
            "league.season": int(season),
            "fixture.status.short": {"$in": finished_statuses}
        })
        
        updated_count = self._update_matches(list(matches), "full")
        print(f"Updated {updated_count} {self.data_type} for league {league_id}, season {season}")
        
        # Count all matches with events data in database
        total_count = self._count_matches_with_data(league_id, season)
        self._update_available_season(league_id, season, total_count)
        
        return total_count

    def update_events_by_league_and_season_missing(self, league_id, season):
        """Update events only for finished matches that don't have events data"""
        print(f"Updating {self.data_type} (missing only) for league {league_id}, season {season}")
        
        finished_statuses = Config.get_finished_match_status_array()
        matches = self.collection_real_matches.find({
            "league.id": int(league_id),
            "league.season": int(season),
            "fixture.status.short": {"$in": finished_statuses},
            "$or": [
                {self.data_field: {"$exists": False}},
                {self.data_field: None},
                {self.data_field: []}
            ]
        })
        
        updated_count = self._update_matches(list(matches), "missing")
        print(f"Updated {updated_count} {self.data_type} (missing only) for league {league_id}, season {season}")
        
        # Count all matches with events data in database
        total_count = self._count_matches_with_data(league_id, season)
        self._update_available_season(league_id, season, total_count)
        
        return total_count

    def update_events_by_league_and_season(self, league_id, season):
        """Backward compatibility: alias for full update"""
        return self.update_events_by_league_and_season_full(league_id, season)

    def _update_available_season(self, league_id, season, count):
        """Update available_seasons for a league with events count"""
        setting = self.collection_settings.find_one({"league_id": int(league_id)})
        if not setting:
            return
        
        available_seasons = setting.get("available_seasons", [])
        
        season_found = False
        for season_data in available_seasons:
            if season_data.get("season") == season:
                season_data[self.data_field] = count if count > 0 else None
                season_found = True
                break
        
        if season_found:
            self.collection_settings.update_one(
                {"league_id": int(league_id)},
                {"$set": {"available_seasons": available_seasons}}
            )
            print(f"Updated {self.data_type}_count for league {league_id}, season {season}: {count}")
        else:
            print(f"Season {season} not found in available_seasons for league {league_id}, skipping {self.data_type} update")

    def update_available_season_with_events(self, league_id, season, events_count):
        """Public alias for backward compatibility"""
        self._update_available_season(league_id, season, events_count)
