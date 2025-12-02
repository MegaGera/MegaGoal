import datetime
from ..utils import MatchUpdater
from ..config import Config

def fetch_leagues_to_update_daily(updater):
    """Fetch leagues to update based on daily update criteria"""
    today = datetime.datetime.today().replace(hour=0, minute=0, second=0, microsecond=0)
    now = datetime.datetime.today()

    leagues_to_update = updater.collection_settings.find({
        "is_active": True,
        "daily_update": True,
        "next_match": {"$lte": today + datetime.timedelta(days=1), "$gte": today},
        "$or": [
            {"last_daily_update": {"$lte": now - datetime.timedelta(minutes=10)}},
            {"last_daily_update": {"$exists": False}}
        ]
    })

    leagues = [league for league in leagues_to_update]
    print(f"Leagues to update: {len(leagues)}")
    return leagues

def fetch_actual_matches_by_league(updater, league_id):
    """Check if there are actual matches to update by league"""
    today = datetime.datetime.today().replace(hour=0, minute=0, second=0, microsecond=0)
    now = datetime.datetime.today()

    real_matches_to_update = updater.collection_real_matches.find({
        "league.id": league_id,
        "fixture.timestamp": {"$lte": now.timestamp(), "$gte": today.timestamp()},
        "fixture.status.short": {"$nin": Config.get_finished_match_status_array()}
    })

    real_matches = [real_match for real_match in real_matches_to_update]
    if len(real_matches) > 0:
        print(f"Found {len(real_matches)} real matches to update in league {league_id}")
    else:
        print(f"There are no real matches to update in league {league_id}")
    return len(real_matches) > 0

def perform_daily_update():
    """Perform daily update operation"""
    today = datetime.datetime.today()
    print("Starting matches_updater_daily.py")
    print(f"-------------- Starting New Update On --------------")
    print(today.strftime('%Y-%m-%d %H:%M:%S'))
    
    updater = MatchUpdater()
    leagues = fetch_leagues_to_update_daily(updater)
    
    for league in leagues:
        league_id = league["league_id"]
        season = league["season"]
        if fetch_actual_matches_by_league(updater, league_id):
            matches = updater.get_matches_from_api(
                league_id, 
                season, 
                date=(today - datetime.timedelta(days=1)).strftime('%Y-%m-%d'),
                date_to=today.strftime('%Y-%m-%d')
            )
            updater.add_real_matches(matches)
            updater.update_league_daily_update(league_id)
            print("OK")

if __name__ == "__main__":
    perform_daily_update() 