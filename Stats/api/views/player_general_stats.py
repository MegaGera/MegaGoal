from collections import Counter
from datetime import datetime, timedelta
import os

import pandas as pd
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView


class PlayerGeneralStatsAPIView(APIView):
    """
    Provides aggregate statistics for a specific player based on the matches a user has watched.
    This mirrors the structure returned by TeamGeneralStatsAPIView so it can drive the same quick stats carousel.
    """

    def get(self, request, *args, **kwargs):
        validate_data = getattr(request, 'validateData', None)
        if validate_data:
            username = validate_data.get('data', {}).get('username')
        else:
            username = os.getenv('USERNAME_DEV')

        if username is None:
            return Response({"error": "Username parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        player_id_param = request.query_params.get('player_id')
        if player_id_param is None:
            return Response({"error": "player_id parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            player_id = int(player_id_param)
        except (TypeError, ValueError):
            return Response({"error": "player_id must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

        matches_collection = settings.MONGO_DB['matches']
        user_matches = list(matches_collection.find({'user.username': username}))

        if not user_matches:
            return Response(self._empty_response(), status=status.HTTP_200_OK)

        matches_df = pd.DataFrame(user_matches)

        if matches_df.empty:
            return Response(self._empty_response(), status=status.HTTP_200_OK)

        fixture_ids = matches_df['fixture'].apply(lambda x: x.get('id')).dropna().astype(int).tolist()
        if not fixture_ids:
            return Response(self._empty_response(), status=status.HTTP_200_OK)

        real_matches_collection = settings.MONGO_DB['real_matches']
        pipeline = [
            {
                '$match': {
                    'fixture.id': {'$in': fixture_ids},
                    '$or': [
                        {'lineups.startXI.player.id': player_id},
                        {'lineups.substitutes.player.id': player_id},
                        {
                            'events.type': {'$regex': 'subst', '$options': 'i'},
                            '$or': [
                                {'events.player.id': player_id},
                                {'events.assist.id': player_id}
                            ]
                        },
                        {
                            'events.type': {'$regex': 'goal', '$options': 'i'},
                            '$or': [
                                {'events.player.id': player_id},
                                {'events.assist.id': player_id}
                            ]
                        }
                    ]
                }
            },
            {
                '$project': {
                    'fixture.id': 1,
                    'lineups': 1,
                    'events': {'$ifNull': ['$events', []]},
                    'teams': 1,
                    'league': 1,
                    'goals': 1
                }
            }
        ]

        real_matches_dict = {
            match['fixture']['id']: match
            for match in real_matches_collection.aggregate(pipeline)
        }

        if not real_matches_dict:
            return Response(self._empty_response(), status=status.HTTP_200_OK)

        total_matches = 0
        total_goals = 0
        total_assists = 0
        matches_by_season = Counter()
        goals_by_season = Counter()
        assists_by_season = Counter()
        league_counts = Counter()
        opponent_match_counts = Counter()
        opponent_goal_counts = Counter()
        monthly_activity_counts = Counter()
        last_match_timestamp = None

        year_ago = datetime.now() - timedelta(days=365)

        for _, match_row in matches_df.iterrows():
            fixture = match_row.get('fixture', {})
            fixture_id = fixture.get('id')
            if fixture_id is None:
                continue

            real_match = real_matches_dict.get(fixture_id)
            if not real_match:
                continue

            player_team_id, player_participated = self._find_player_team(real_match, player_id)
            if not player_participated:
                continue

            league_info = match_row.get('league', {}) if isinstance(match_row.get('league'), dict) else {}
            league_id = league_info.get('id')
            league_name = league_info.get('name')
            season = league_info.get('season')

            fixture_timestamp = fixture.get('timestamp')
            match_datetime = datetime.fromtimestamp(fixture_timestamp) if fixture_timestamp else None

            opponent_id = None
            opponent_name = None
            is_home = None
            teams_info = real_match.get('teams', {}) if isinstance(real_match.get('teams'), dict) else {}
            home_team = teams_info.get('home', {}) if isinstance(teams_info.get('home'), dict) else {}
            away_team = teams_info.get('away', {}) if isinstance(teams_info.get('away'), dict) else {}

            if player_team_id is not None:
                if player_team_id == home_team.get('id'):
                    opponent_id = away_team.get('id')
                    opponent_name = away_team.get('name')
                    is_home = True
                elif player_team_id == away_team.get('id'):
                    opponent_id = home_team.get('id')
                    opponent_name = home_team.get('name')
                    is_home = False

            match_goals = 0
            match_assists = 0

            for event in real_match.get('events', []):
                event_type = (event.get('type') or '').lower()

                if event_type == 'goal':
                    scorer_id = event.get('player', {}).get('id')
                    assist = event.get('assist')
                    assist_id = assist.get('id') if isinstance(assist, dict) else None

                    if scorer_id == player_id:
                        match_goals += 1

                    if assist_id == player_id:
                        match_assists += 1

            total_matches += 1
            total_goals += match_goals
            total_assists += match_assists

            if season is not None:
                matches_by_season[int(season)] += 1
                if match_goals > 0:
                    goals_by_season[int(season)] += match_goals
                if match_assists > 0:
                    assists_by_season[int(season)] += match_assists

            if league_id is not None and league_name:
                league_counts[(int(league_id), league_name)] += 1

            if opponent_id is not None and opponent_name:
                opponent_match_counts[(int(opponent_id), opponent_name)] += 1
                if match_goals > 0:
                    opponent_goal_counts[(int(opponent_id), opponent_name)] += match_goals

            if match_datetime:
                if last_match_timestamp is None or fixture_timestamp > last_match_timestamp:
                    last_match_timestamp = fixture_timestamp

                if match_datetime >= year_ago:
                    month_key = match_datetime.strftime('%Y-%m')
                    monthly_activity_counts[month_key] += 1

        if total_matches == 0:
            return Response(self._empty_response(), status=status.HTTP_200_OK)

        matches_by_season_list = []
        for season, match_count in sorted(matches_by_season.items(), key=lambda item: item[0], reverse=True)[:5]:
            entry = {
                'season': int(season),
                'matches': int(match_count)
            }
            goals_value = goals_by_season.get(season)
            if goals_value:
                entry['goals'] = int(goals_value)
            assists_value = assists_by_season.get(season)
            if assists_value:
                entry['assists'] = int(assists_value)
            matches_by_season_list.append(entry)

        favourite_teams_list = [
            {'id': team_id, 'name': team_name, 'matches': int(count)}
            for (team_id, team_name), count in opponent_match_counts.most_common(5)
        ]

        favourite_leagues_list = [
            {'id': league_id, 'name': league_name, 'matches': int(count)}
            for (league_id, league_name), count in league_counts.most_common(5)
        ]

        top_goals_teams_list = [
            {'id': team_id, 'name': team_name, 'goals': int(goals)}
            for (team_id, team_name), goals in opponent_goal_counts.most_common(5)
            if goals > 0
        ]

        monthly_activity_list = [
            {'month': month, 'matches': int(count)}
            for month, count in sorted(monthly_activity_counts.items())
        ]

        last_match_date = (
            datetime.fromtimestamp(last_match_timestamp).strftime('%Y-%m-%d')
            if last_match_timestamp
            else None
        )

        goals_per_match = round(total_goals / total_matches, 2) if total_matches > 0 else 0

        response_payload = {
            'totalMatches': int(total_matches),
            'totalGoals': int(total_goals),
            'totalAssists': int(total_assists),
            'goalsPerMatch': goals_per_match,
            'matchesBySeason': matches_by_season_list,
            'monthlyActivity': monthly_activity_list,
            'favouriteTeams': favourite_teams_list,
            'favouriteLeagues': favourite_leagues_list,
            'topGoalsTeams': top_goals_teams_list,
            'lastMatchDate': last_match_date
        }

        return Response(response_payload, status=status.HTTP_200_OK)

    @staticmethod
    def _find_player_team(real_match: dict, player_id: int):
        """
        Determine if the player participated in the match and return the team ID.
        """
        lineups = real_match.get('lineups', []) or []

        for lineup in lineups:
            team = lineup.get('team', {}) if isinstance(lineup.get('team'), dict) else {}
            team_id = team.get('id')

            for player_info in lineup.get('startXI', []) or []:
                player_info_data = player_info.get('player', {}) if isinstance(player_info.get('player'), dict) else {}
                if player_info_data.get('id') == player_id:
                    return team_id, True

            for player_info in lineup.get('substitutes', []) or []:
                player_info_data = player_info.get('player', {}) if isinstance(player_info.get('player'), dict) else {}
                if player_info_data.get('id') == player_id:
                    return team_id, True

        for event in real_match.get('events', []) or []:
            event_type = (event.get('type') or '').lower()
            if event_type == 'subst':
                assist = event.get('assist', {}) if isinstance(event.get('assist'), dict) else {}
                player_out = event.get('player', {}) if isinstance(event.get('player'), dict) else {}
                if assist.get('id') == player_id or player_out.get('id') == player_id:
                    team = event.get('team', {}) if isinstance(event.get('team'), dict) else {}
                    return team.get('id'), True

        return None, False

    @staticmethod
    def _empty_response():
        return {
            'totalMatches': 0,
            'totalGoals': 0,
            'totalAssists': 0,
            'goalsPerMatch': 0,
            'matchesBySeason': [],
            'monthlyActivity': [],
            'favouriteTeams': [],
            'favouriteLeagues': [],
            'topGoalsTeams': [],
            'lastMatchDate': None
        }

