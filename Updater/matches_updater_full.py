import datetime
from utils import MatchUpdater

def fetch_leagues_to_update(updater):
    """Fetch leagues that need updating based on frequency and next match criteria"""
    now = datetime.datetime.today()
    
    # MongoDB query to find leagues that need updating
    leagues_to_update = updater.collection_settings.find({
        "is_active": True,
        "$or": [
            {"$expr": {
                "$lte": [
                    {"$add": ["$last_update", {"$multiply": ["$update_frequency", 86400000]}]},  # Convert days to milliseconds
                    now  # Check if last_update + update_frequency is less than or equal to now
                ]
            }},
            {
                "$and": [
                    {"next_match": {"$ne": None}},  # Check if next_match is not null
                    {"next_match": {"$lte": now}}  # Check if next_match is less than or equal to now
                ]
            }
        ]
    })
    
    leagues = [league for league in leagues_to_update]
    print(f"Leagues to update: {len(leagues)}")
    return leagues

def perform_full_update():
    """Perform full update operation"""
    print("Starting matches_updater_full.py")
    print(f"-------------- Starting New Update On --------------")
    print(datetime.datetime.today().strftime('%Y-%m-%d %H:%M:%S'))
    
    updater = MatchUpdater()
    leagues = fetch_leagues_to_update(updater)
    
    for league in leagues:
        league_id = str(league["league_id"])
        season = str(league["season"])
        print(f"Adding the matches of league {league_id} in {season}")
        json_object_matches = updater.get_matches_from_api(league_id, season)
        updater.add_real_matches(json_object_matches)
        updater.update_league_last_update(int(league_id))
        print("OK")

if __name__ == "__main__":
    perform_full_update() 