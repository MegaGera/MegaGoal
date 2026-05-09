"""
Hourly (at :15) job: from real_matches only, find which competitions have a fixture
today (UTC calendar day by kickoff timestamp), then refresh standings for those leagues
using league_settings.season. Does not fetch or store match payloads from the API.
"""
import datetime
from datetime import timedelta, timezone

from ..standings.updater import StandingsUpdater
from ..utils import MatchUpdater


def _utc_today_timestamp_bounds():
    now = datetime.datetime.now(timezone.utc)
    start = datetime.datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    return int(start.timestamp()), int(end.timestamp())


def perform_matchday_standings_update():
    print("Starting standings_updater_matchday_hourly.py")
    now = datetime.datetime.now(timezone.utc)
    print(now.strftime("%Y-%m-%d %H:%M:%S UTC"))

    start_ts, end_ts = _utc_today_timestamp_bounds()
    match_updater = MatchUpdater()
    real_matches = match_updater.collection_real_matches

    # Aggregate competitions (league ids) with at least one match kicking off today (UTC day)
    league_ids = real_matches.distinct(
        "league.id",
        {"fixture.timestamp": {"$gte": start_ts, "$lt": end_ts}},
    )
    league_ids = sorted({int(lid) for lid in league_ids if lid is not None})
    print(
        f"UTC day window {start_ts}–{end_ts}: {len(league_ids)} competition(s) with scheduled matches — {league_ids}"
    )

    standings_updater = StandingsUpdater()
    settings_coll = match_updater.collection_settings
    updated = 0
    for league_id in league_ids:
        setting = settings_coll.find_one({"league_id": league_id})
        if not setting:
            print(f"Skip league {league_id}: not in league_settings")
            continue
        season = setting.get("season")
        if season is None:
            print(f"Skip league {league_id}: no current season in league_settings")
            continue
        try:
            standings_updater.update_standings_by_league_and_season(league_id, season)
            updated += 1
        except Exception as e:
            print(f"Standings update failed league={league_id} season={season}: {e}")

    print(f"Matchday hourly standings finished; updated {updated} league(s).")


if __name__ == "__main__":
    perform_matchday_standings_update()
