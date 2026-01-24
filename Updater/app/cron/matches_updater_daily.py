import datetime
from ..utils import MatchUpdater
from ..events.updater import EventsUpdater
from ..statistics.updater import StatisticsUpdater
from ..lineups.updater import LineupsUpdater
from ..config import Config

def fetch_leagues_to_update_daily(updater):
    """Fetch leagues to update based on daily update criteria"""
    today = datetime.datetime.today().replace(hour=0, minute=0, second=0, microsecond=0)
    now = datetime.datetime.today()

    leagues_to_update = updater.collection_settings.find({
        "is_active": True,
        "daily_update": True,
        "next_match": {"$lte": today + datetime.timedelta(days=1), "$gte": today}
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
    events_updater = EventsUpdater()
    statistics_updater = StatisticsUpdater()
    lineups_updater = LineupsUpdater()
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
            # Pass matches["response"] since the updaters expect a list of match dictionaries
            matches_list = matches.get("response", [])
            
            # Filter non-finished matches for events, statistics, and lineups updates
            finished_statuses = Config.get_finished_match_status_array()
            non_finished_matches = [
                match for match in matches_list 
                if match.get("fixture", {}).get("status", {}).get("short") not in finished_statuses
            ]
            
            # Update events, statistics, and lineups only for non-finished matches
            events_updater.update_events_by_matches(non_finished_matches, league_id, season)
            statistics_updater.update_statistics_by_matches(non_finished_matches, league_id, season)
            lineups_updater.update_lineups_by_matches(non_finished_matches, league_id, season)

            updater.update_league_daily_update(league_id)
            print("OK")

if __name__ == "__main__":
    perform_daily_update() 