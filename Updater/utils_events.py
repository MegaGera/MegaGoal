import http.client
import json
import datetime
from config import Config

class EventsUpdater:
    """Utilities for events updating operations"""
    
    def __init__(self):
        self.db = Config.get_database()
        self.collection_real_matches = self.db['real_matches']
        self.collection_settings = self.db['league_settings']
        self.headers = Config.get_api_headers()
        self.url = Config.RAPIDAPI_HOST

    def get_fixture_events_from_api(self, fixture_id: int):
        """Fetch fixture events from external API"""
        conn = http.client.HTTPSConnection(self.url)
        endpoint = f"/fixtures/events?fixture={fixture_id}"
        print(f"Getting events from API for fixture {fixture_id}")
        
        conn.request("GET", endpoint, headers=self.headers)
        response = conn.getresponse()
        return json.loads(response.read())

    def update_events_by_league_and_season(self, league_id, season):
        """Update events for all finished matches in a league and season"""
        print(f"Updating events for league {league_id}, season {season}")
        
        # Get finished matches for this league and season
        finished_statuses = Config.get_finished_match_status_array()
        matches = self.collection_real_matches.find({
            "league.id": int(league_id),
            "league.season": int(season),
            "fixture.status.short": {"$in": finished_statuses}
        })
        
        total_events = 0
        matches_list = list(matches)
        
        for match in matches_list:
            fixture_id = match["fixture"]["id"]
            
            # Get events from API
            events_data = self.get_fixture_events_from_api(fixture_id)
            events_response = events_data.get("response", [])
            
            if events_response:
                # Update match with events
                query_filter = {"fixture.id": int(fixture_id)}
                update_doc = {"$set": {"events": events_response}}
                self.collection_real_matches.update_one(query_filter, update_doc)
                
                total_events += len(events_response)
                print(f"Updated events for fixture {fixture_id}")
        
        print(f"Updated {total_events} events for league {league_id}, season {season}")
        
        # Update available_seasons with events count
        self.update_available_season_with_events(league_id, season, total_events)
        
        return total_events

    def update_available_season_with_events(self, league_id, season, events_count):
        """Update available_seasons for a league with events count"""
        # Get current available_seasons
        setting = self.collection_settings.find_one({"league_id": int(league_id)})
        if not setting:
            return
        
        available_seasons = setting.get("available_seasons", [])
        
        # Find if season already exists
        season_found = False
        for season_data in available_seasons:
            if season_data.get("season") == season:
                season_data["events"] = events_count if events_count > 0 else None
                season_found = True
                break
        
        # Only update if season exists in available_seasons
        if season_found:
            # Update the settings
            self.collection_settings.update_one(
                {"league_id": int(league_id)},
                {"$set": {"available_seasons": available_seasons}}
            )
            print(f"Updated events_count for league {league_id}, season {season}: {events_count}")
        else:
            print(f"Season {season} not found in available_seasons for league {league_id}, skipping events update")
