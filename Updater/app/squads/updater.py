import http.client
import json
import datetime
import time
from ..config import Config


class SquadsUpdater:
    """Update current squads on team documents from API-Football /players/squads."""

    def __init__(self):
        self.db = Config.get_database()
        self.collection_teams = self.db['teams']
        self.collection_league_settings = self.db['league_settings']
        self.headers = Config.get_api_headers()
        self.url = Config.RAPIDAPI_HOST

    def _make_api_request_with_retry(self, endpoint, max_retries=5, retry_delay=5):
        """Make an API request with rate limit retry logic."""
        for attempt in range(max_retries):
            try:
                conn = http.client.HTTPSConnection(self.url)
                conn.request("GET", endpoint, headers=self.headers)
                response = conn.getresponse()
                response_data = response.read()

                try:
                    json_response = json.loads(response_data)
                except json.JSONDecodeError:
                    response_text = response_data.decode('utf-8', errors='ignore')
                    if "rateLimit" in response_text or "Too many requests" in response_text:
                        if attempt < max_retries - 1:
                            print(
                                f"Rate limit detected (attempt {attempt + 1}/{max_retries}). "
                                f"Waiting {retry_delay} seconds before retry..."
                            )
                            time.sleep(retry_delay)
                            continue
                        raise Exception(f"Rate limit exceeded after {max_retries} attempts")
                    raise Exception(f"Invalid JSON response: {response_text[:200]}")

                if "errors" in json_response:
                    errors = json_response.get("errors", {})

                    if "rateLimit" in errors:
                        if attempt < max_retries - 1:
                            rate_limit_msg = errors.get("rateLimit", "Rate limit exceeded")
                            print(
                                f"Rate limit detected: {rate_limit_msg} "
                                f"(attempt {attempt + 1}/{max_retries}). "
                                f"Waiting {retry_delay} seconds before retry..."
                            )
                            time.sleep(retry_delay)
                            continue
                        raise Exception(
                            f"Rate limit exceeded after {max_retries} attempts: "
                            f"{errors.get('rateLimit', 'Unknown error')}"
                        )

                    if errors:
                        error_messages = []
                        for key, value in errors.items():
                            if isinstance(value, str):
                                error_messages.append(f"{key}: {value}")
                            else:
                                error_messages.append(f"{key}: {json.dumps(value)}")
                        error_str = "; ".join(error_messages)
                        print(f"API error detected: {error_str}")
                        raise Exception(f"API returned errors: {error_str}")

                return json_response

            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                print(
                    f"API request failed (attempt {attempt + 1}/{max_retries}): {str(e)}. "
                    f"Waiting {retry_delay} seconds before retry..."
                )
                time.sleep(retry_delay)

        raise Exception(f"Failed to make API request after {max_retries} attempts")

    def get_league_current_season(self, league_id):
        """Read current season from league_settings for this league."""
        setting = self.collection_league_settings.find_one({"league_id": int(league_id)})
        if not setting:
            raise Exception(f"League settings not found for league {league_id}")
        season = setting.get("season")
        if season is None:
            raise Exception(f"No current season set for league {league_id}")
        return int(season)

    def get_teams_for_league_season(self, league_id, season):
        """Teams in Mongo that have this league + season in their seasons array."""
        query = {
            "seasons": {
                "$elemMatch": {
                    "league": str(league_id),
                    "season": str(season),
                }
            }
        }
        return list(self.collection_teams.find(query, {"team.id": 1, "team.name": 1}))

    def get_squad_from_api(self, team_id):
        """GET /players/squads?team={team_id}"""
        endpoint = f"/players/squads?team={team_id}"
        print(f"Getting squad from API for team {team_id}")
        return self._make_api_request_with_retry(endpoint)

    def normalize_squad_players(self, players):
        """Keep only the squad fields we store on team documents."""
        normalized = []
        for player in players or []:
            if not isinstance(player, dict) or player.get("id") is None:
                continue
            normalized.append({
                "id": player.get("id"),
                "name": player.get("name"),
                "age": player.get("age"),
                "number": player.get("number"),
                "position": player.get("position"),
                "photo": player.get("photo"),
            })
        return normalized

    def update_team_squad(self, team_id):
        """Fetch and store current squad for one team. Returns player count."""
        squad_data = self.get_squad_from_api(team_id)
        response = squad_data.get("response", [])

        players = []
        if response:
            # API returns [{ team, players }] for the requested team
            first = response[0] if isinstance(response, list) else response
            players = self.normalize_squad_players(first.get("players", []))

        result = self.collection_teams.update_one(
            {"team.id": int(team_id)},
            {
                "$set": {
                    "squad": {
                        "players": players,
                        "last_update": datetime.datetime.now(),
                    }
                }
            },
        )

        if result.matched_count == 0:
            print(f"No team found with ID {team_id} to update squad")
            return None

        print(f"Updated squad for team {team_id}: {len(players)} players")
        return len(players)

    def update_squads_by_league(self, league_id):
        """
        Update squads for all Mongo teams of the league's current season.
        Does not touch the players collection.
        """
        season = self.get_league_current_season(league_id)
        teams = self.get_teams_for_league_season(league_id, season)

        print(
            f"Updating squads for league {league_id}, current season {season}: "
            f"{len(teams)} teams in Mongo"
        )

        updated = 0
        failed = 0
        total_players = 0

        for team_doc in teams:
            team_info = team_doc.get("team") or {}
            team_id = team_info.get("id")
            team_name = team_info.get("name", "unknown")
            if team_id is None:
                continue
            try:
                count = self.update_team_squad(team_id)
                if count is not None:
                    updated += 1
                    total_players += count
                else:
                    failed += 1
            except Exception as e:
                failed += 1
                print(f"Failed to update squad for team {team_id} ({team_name}): {e}")

        return {
            "status": "success",
            "message": (
                f"Updated squads for {updated}/{len(teams)} teams "
                f"in league {league_id} season {season}"
            ),
            "league_id": int(league_id),
            "season": season,
            "teams_found": len(teams),
            "teams_updated": updated,
            "teams_failed": failed,
            "players_stored": total_players,
        }
