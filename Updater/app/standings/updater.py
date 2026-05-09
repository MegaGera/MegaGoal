from datetime import datetime, timezone

from ..utils import MatchUpdater


class StandingsUpdater:
    """Fetch league standings from API-Football and store in league_standings collection."""

    def __init__(self):
        self.match_updater = MatchUpdater()
        self.collection_standings = self.match_updater.db['league_standings']

    def update_standings_by_league_and_season(self, league_id, season):
        """
        GET /standings?league=&season= and upsert into league_standings (one doc per league_id).
        Returns True if API returned at least one standings block, False otherwise.
        """
        league_id = int(league_id)
        season = int(season)
        endpoint = f"/standings?league={league_id}&season={season}"
        print(f"Fetching standings from API for league {league_id}, season {season}")
        api_json = self.match_updater._make_api_request_with_retry(endpoint)

        response_list = api_json.get("response") or []
        if not response_list:
            print(f"No standings in API response for league {league_id}, season {season}")
            return False

        block = response_list[0]
        league_block = block.get("league") or {}
        standings_nested = league_block.get("standings")
        if standings_nested is None:
            print(f"API response missing league.standings for league {league_id}, season {season}")
            return False

        league_snapshot = {
            "id": league_block["id"],
            "name": league_block["name"],
            "country": league_block["country"],
            "logo": league_block["logo"],
            "flag": league_block.get("flag"),
            "season": league_block["season"],
        }

        now = datetime.now(timezone.utc)
        season_entry = {
            "season": season,
            "league": league_snapshot,
            "standings": standings_nested,
            "fetched_at": now,
        }

        existing = self.collection_standings.find_one({"league_id": league_id})
        if not existing:
            self.collection_standings.insert_one({
                "league_id": league_id,
                "seasons": [season_entry],
                "updated_at": now,
            })
            print(f"Inserted standings doc for league {league_id}, season {season}")
            return True

        seasons = list(existing.get("seasons") or [])
        replaced = False
        for i, s in enumerate(seasons):
            if s.get("season") == season:
                seasons[i] = season_entry
                replaced = True
                break
        if not replaced:
            seasons.append(season_entry)

        self.collection_standings.update_one(
            {"league_id": league_id},
            {"$set": {"seasons": seasons, "updated_at": now}},
        )
        print(f"Updated standings for league {league_id}, season {season}")
        return True
