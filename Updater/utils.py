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
        self.collection_settings = self.db['settings']
        self.collection_leagues = self.db['leagues']
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
    
    def add_available_season(self, league_id, season):
        """Add a season to available_seasons for a league in the settings collection, only if not present"""
        self.collection_settings.update_one(
            {"league_id": int(league_id)},
            {"$addToSet": {"available_seasons": int(season)}}
        )

    def update_league_matches(self, league_id, season):
        """Fetch matches from API and update DB for a given league and season, and add season to available_seasons"""
        matches = self.get_matches_from_api(league_id, season)
        self.add_real_matches(matches)
        self.update_league_last_update(league_id)
        self.add_available_season(league_id, season)
    
    def update_league_season(self, league_id, season):
        """Update the season field for a league in the settings collection"""
        result = self.collection_settings.update_one(
            {"league_id": int(league_id)},
            {"$set": {"season": int(season)}}
        )
        return result.modified_count