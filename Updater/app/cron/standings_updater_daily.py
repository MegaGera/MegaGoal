import datetime
from ..standings.updater import StandingsUpdater
from ..utils import MatchUpdater


def perform_standings_daily_update():
    """
    Refresh standings for each league_settings row using its selected current season (`season`),
    when `season` is set. One API call per league. Schedule: 23:30 daily (see matches_updater_cron).
    """
    print("Starting standings_updater_daily.py")
    print(datetime.datetime.today().strftime('%Y-%m-%d %H:%M:%S'))

    match_updater = MatchUpdater()
    standings_updater = StandingsUpdater()
    settings = match_updater.collection_settings.find({})

    jobs = 0
    for setting in settings:
        league_id = setting.get("league_id")
        season = setting.get("season")
        if league_id is None or season is None:
            continue
        try:
            standings_updater.update_standings_by_league_and_season(league_id, season)
            jobs += 1
        except Exception as e:
            print(f"Standings update failed league={league_id} season={season}: {e}")

    print(f"Standings daily update finished; processed {jobs} league(s) using current season from league_settings.")


if __name__ == "__main__":
    perform_standings_daily_update()
