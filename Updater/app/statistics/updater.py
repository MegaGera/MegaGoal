import http.client
import json
import time
from ..config import Config
from ..utils import MatchUpdater

class StatisticsUpdater:
    """Utilities for statistics updating operations"""
    
    def __init__(self):
        self.db = Config.get_database()
        self.collection_real_matches = self.db['real_matches']
        self.collection_settings = self.db['league_settings']
        self.headers = Config.get_api_headers()
        self.url = Config.RAPIDAPI_HOST
        self.data_field = "statistics"
        self.data_field_checked = "statistics_checked"
        self.data_type = "statistics"

    def _make_api_request_with_retry(self, endpoint, max_retries=5, retry_delay=5):
        """Make an API request with rate limit retry logic
        
        Args:
            endpoint: The API endpoint to call
            max_retries: Maximum number of retries (default: 5)
            retry_delay: Delay in seconds between retries (default: 5)
        
        Returns:
            dict: The JSON response from the API
        
        Raises:
            Exception: If all retries are exhausted or if there's a non-rate-limit error
        """
        for attempt in range(max_retries):
            try:
                conn = http.client.HTTPSConnection(self.url)
                conn.request("GET", endpoint, headers=self.headers)
                response = conn.getresponse()
                response_data = response.read()
                
                # Parse JSON response
                try:
                    json_response = json.loads(response_data)
                except json.JSONDecodeError:
                    # If JSON parsing fails, check if it's a rate limit error in the raw response
                    response_text = response_data.decode('utf-8', errors='ignore')
                    if "rateLimit" in response_text or "Too many requests" in response_text:
                        if attempt < max_retries - 1:
                            print(f"Rate limit detected (attempt {attempt + 1}/{max_retries}). Waiting {retry_delay} seconds before retry...")
                            time.sleep(retry_delay)
                            continue
                        else:
                            raise Exception(f"Rate limit exceeded after {max_retries} attempts")
                    else:
                        raise Exception(f"Invalid JSON response: {response_text[:200]}")
                
                # Check for errors in the JSON response
                if "errors" in json_response:
                    errors = json_response.get("errors", {})
                    
                    # Check if it's a rate limit error (retry)
                    if "rateLimit" in errors:
                        if attempt < max_retries - 1:
                            rate_limit_msg = errors.get("rateLimit", "Rate limit exceeded")
                            print(f"Rate limit detected: {rate_limit_msg} (attempt {attempt + 1}/{max_retries}). Waiting {retry_delay} seconds before retry...")
                            time.sleep(retry_delay)
                            continue
                        else:
                            raise Exception(f"Rate limit exceeded after {max_retries} attempts: {errors.get('rateLimit', 'Unknown error')}")
                    
                    # Check if there are any other errors (don't retry, raise immediately)
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
                
                # Success - return the response
                return json_response
                
            except Exception as e:
                # If it's the last attempt, raise the exception
                if attempt == max_retries - 1:
                    raise
                # For other errors, wait and retry
                print(f"API request failed (attempt {attempt + 1}/{max_retries}): {str(e)}. Waiting {retry_delay} seconds before retry...")
                time.sleep(retry_delay)
        
        # This should never be reached, but just in case
        raise Exception(f"Failed to make API request after {max_retries} attempts")

    def _get_data_from_api(self, fixture_id: int):
        """Fetch fixture statistics from external API"""
        endpoint = f"/fixtures/{self.data_type}?fixture={fixture_id}"
        print(f"Getting {self.data_type} from API for fixture {fixture_id}")
        return self._make_api_request_with_retry(endpoint)

    def get_fixture_statistics_from_api(self, fixture_id: int):
        """Fetch fixture statistics from external API (public alias)"""
        return self._get_data_from_api(fixture_id)

    def update_match_statistics(self, fixture_id: int, full_update=True):
        """Fetch and persist statistics for a given fixture into real_matches document"""
        try:
            data_json = self._get_data_from_api(fixture_id)
            data_response = data_json.get("response", [])

            # Upsert statistics field into real_matches
            query_filter = {"fixture.id": int(fixture_id)}
            update_doc = {"$set": {self.data_field: data_response, self.data_field_checked: full_update}}
            result = self.collection_real_matches.update_one(query_filter, update_doc)

            if result.matched_count == 0:
                print(f"No real_match found for fixture {fixture_id} to update {self.data_type}")
                return False

            print(f"Updated {self.data_type} for fixture {fixture_id}")
            return True
        except Exception as e:
            print(f"Error updating {self.data_type} for fixture {fixture_id}: {str(e)}")
            return False

    def _count_matches_with_data(self, league_id, season):
        """Count finished matches that have statistics data"""
        finished_statuses = Config.get_finished_match_status_array()
        count = self.collection_real_matches.count_documents({
            "league.id": int(league_id),
            "league.season": int(season),
            "fixture.status.short": {"$in": finished_statuses},
            self.data_field: {"$exists": True, "$ne": None, "$ne": []}
        })
        return count

    def _update_matches(self, matches_list, full_update=True):
        """Update matches from the provided list"""
        updated_count = 0
        
        for match in matches_list:
            fixture_id = match["fixture"]["id"]
            success = self.update_match_statistics(fixture_id, full_update)
            if success:
                updated_count += 1
        
        return updated_count

    def update_statistics_by_league_and_season_full(self, league_id, season):
        """Update statistics for all finished matches in a league and season"""
        print(f"Updating {self.data_type} (full) for league {league_id}, season {season}")
        
        finished_statuses = Config.get_finished_match_status_array()
        matches = self.collection_real_matches.find({
            "league.id": int(league_id),
            "league.season": int(season),
            "fixture.status.short": {"$in": finished_statuses}
        })
        
        updated_count = self._update_matches(list(matches), full_update=True)
        print(f"Updated {updated_count} {self.data_type} for league {league_id}, season {season}")
        
        # Count all matches with statistics data in database
        total_count = self._count_matches_with_data(league_id, season)
        self._update_available_season(league_id, season, total_count)
        
        return total_count

    def update_statistics_by_league_and_season_missing(self, league_id, season):
        """Update statistics only for finished matches that don't have statistics data"""
        print(f"Updating {self.data_type} (missing only) for league {league_id}, season {season}")
        
        finished_statuses = Config.get_finished_match_status_array()
        matches = self.collection_real_matches.find({
            "league.id": int(league_id),
            "league.season": int(season),
            "fixture.status.short": {"$in": finished_statuses},
            "$and": [
                {
                    "$or": [
                        {self.data_field: {"$exists": False}},
                        {self.data_field: None},
                        {self.data_field: []}
                    ]
                },
                {
                    "$or": [
                        {self.data_field_checked: {"$exists": False}},
                        {self.data_field_checked: False}
                    ]
                }
            ]
        })
        
        updated_count = self._update_matches(list(matches), full_update=True)
        print(f"Updated {updated_count} {self.data_type} (missing only) for league {league_id}, season {season}")
        
        # Count all matches with statistics data in database
        total_count = self._count_matches_with_data(league_id, season)
        self._update_available_season(league_id, season, total_count)
        
        return total_count

    def update_statistics_by_matches(self, matches_list, league_id, season):
        """Update statistics for a list of matches"""
        updated_count = self._update_matches(list(matches_list), full_update=False)
        print(f"Updated {updated_count} {self.data_type} (daily update) for league {league_id}")

        # Count all matches with statistics data in database
        total_count = self._count_matches_with_data(league_id, season)
        self._update_available_season(league_id, season, total_count)
        
        return total_count

    def update_statistics_by_league_and_season(self, league_id, season):
        """Backward compatibility: alias for full update"""
        return self.update_statistics_by_league_and_season_full(league_id, season)

    def _update_available_season(self, league_id, season, count):
        """Update available_seasons for a league with statistics count"""
        MatchUpdater.update_available_season(
            self.collection_settings, 
            league_id, 
            season, 
            self.data_field, 
            count
        )
