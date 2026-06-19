import datetime
from ..utils import MatchUpdater
from ..events.updater import EventsUpdater
from ..statistics.updater import StatisticsUpdater
from ..lineups.updater import LineupsUpdater
from ..config import Config

# Keep refreshing events/statistics/lineups for finished matches until this long after kickoff.
DETAIL_UPDATE_HOURS_AFTER_KICKOFF = 3
DETAIL_UPDATE_WINDOW_SECONDS = DETAIL_UPDATE_HOURS_AFTER_KICKOFF * 3600


def _fixture_timestamp(match):
    return match.get("fixture", {}).get("timestamp")


def is_within_detail_update_window(match, now_ts):
    """True if now is between kickoff and kickoff + DETAIL_UPDATE_HOURS_AFTER_KICKOFF."""
    fixture_ts = _fixture_timestamp(match)
    if fixture_ts is None:
        return False
    elapsed = now_ts - fixture_ts
    return 0 <= elapsed < DETAIL_UPDATE_WINDOW_SECONDS


def should_update_match_details(match, now_ts):
    """Update details for live matches, and for any status within 3h after kickoff."""
    status = match.get("fixture", {}).get("status", {}).get("short")
    finished_statuses = Config.get_finished_match_status_array()
    if status not in finished_statuses:
        return True
    return is_within_detail_update_window(match, now_ts)

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
    now_ts = now.timestamp()
    kickoff_window_start = now_ts - DETAIL_UPDATE_WINDOW_SECONDS
    finished_statuses = Config.get_finished_match_status_array()

    real_matches_to_update = updater.collection_real_matches.find({
        "league.id": league_id,
        "fixture.timestamp": {"$lte": now_ts, "$gte": today.timestamp()},
        "$or": [
            {"fixture.status.short": {"$nin": finished_statuses}},
            {"fixture.timestamp": {"$gte": kickoff_window_start}},
        ],
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
            now_ts = datetime.datetime.today().timestamp()

            matches_for_details = [
                match for match in matches_list
                if should_update_match_details(match, now_ts)
            ]

            events_updater.update_events_by_matches(matches_for_details, league_id, season)
            statistics_updater.update_statistics_by_matches(matches_for_details, league_id, season)
            lineups_updater.update_lineups_by_matches(matches_for_details, league_id, season)

            updater.update_league_daily_update(league_id)
            print("OK")

if __name__ == "__main__":
    perform_daily_update() 