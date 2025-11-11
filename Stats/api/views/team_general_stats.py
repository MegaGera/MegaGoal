from datetime import datetime, timedelta
from collections import Counter
import os

import pandas as pd
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView


class TeamGeneralStatsAPIView(APIView):
    def get(self, request, *args, **kwargs):
        validate_data = getattr(request, 'validateData', None)
        if validate_data:
            username = validate_data.get('data', {}).get('username')
        else:
            username = os.getenv('USERNAME_DEV')

        if username is None:
            return Response({"error": "Username parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        team_id_param = request.query_params.get('team_id')
        if team_id_param is None:
            return Response({"error": "team_id parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            team_id = int(team_id_param)
        except (TypeError, ValueError):
            return Response({"error": "team_id must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

        collection_matches = settings.MONGO_DB['matches']

        query = {
            '$and': [
                {'user.username': username},
                {'goals.home': {'$exists': True, '$ne': None}},
                {'goals.away': {'$exists': True, '$ne': None}},
                {
                    '$or': [
                        {'teams.home.id': team_id},
                        {'teams.away.id': team_id},
                    ]
                }
            ]
        }

        matches = list(collection_matches.find(query))

        if not matches:
            return Response(self._empty_response(), status=status.HTTP_200_OK)

        df = pd.DataFrame(matches).copy()

        df['is_home'] = df['teams'].apply(lambda teams: teams['home']['id'] == team_id)
        df['team_goals'] = df.apply(lambda row: row['goals']['home'] if row['is_home'] else row['goals']['away'], axis=1)
        df['opponent_id'] = df.apply(lambda row: row['teams']['away']['id'] if row['is_home'] else row['teams']['home']['id'], axis=1)
        df['opponent_name'] = df.apply(lambda row: row['teams']['away']['name'] if row['is_home'] else row['teams']['home']['name'], axis=1)

        total_matches = int(len(df))
        total_goals = int(df['team_goals'].sum())
        goals_per_match = round(total_goals / total_matches, 2) if total_matches > 0 else 0

        matches_by_season = self._calculate_matches_by_season(df)
        monthly_activity = self._calculate_monthly_activity(df)
        favourite_opponents = self._find_favourite_opponents(df)
        favourite_leagues = self._find_favourite_leagues(df)
        top_goals_opponents = self._find_top_goals_opponents(df)
        last_match_date = self._get_last_match_date(df)

        return Response({
            'totalMatches': total_matches,
            'matchesBySeason': matches_by_season,
            'goalsPerMatch': goals_per_match,
            'favouriteTeams': favourite_opponents,
            'monthlyActivity': monthly_activity,
            'favouriteLeagues': favourite_leagues,
            'topGoalsTeams': top_goals_opponents,
            'totalGoals': total_goals,
            'lastMatchDate': last_match_date
        }, status=status.HTTP_200_OK)

    def _empty_response(self):
        return {
            'totalMatches': 0,
            'matchesBySeason': [],
            'goalsPerMatch': 0,
            'favouriteTeams': [],
            'monthlyActivity': [],
            'favouriteLeagues': [],
            'topGoalsTeams': [],
            'totalGoals': 0,
            'lastMatchDate': None
        }

    def _calculate_matches_by_season(self, df: pd.DataFrame):
        if df.empty:
            return []

        seasons = df['league'].apply(lambda league: league['season'])
        season_counts = seasons.value_counts().sort_index(ascending=False)

        matches_by_season = []
        for season, count in season_counts.head(5).items():
            matches_by_season.append({
                'season': int(season),
                'matches': int(count)
            })

        return matches_by_season

    def _calculate_monthly_activity(self, df: pd.DataFrame):
        if df.empty:
            return []

        df = df.copy()
        df['match_date'] = pd.to_datetime(df['fixture'].apply(lambda fixture: fixture['timestamp']), unit='s')

        year_ago = datetime.now() - timedelta(days=365)
        recent_matches = df[df['match_date'] >= year_ago]

        if recent_matches.empty:
            return []

        recent_matches['year_month'] = recent_matches['match_date'].dt.strftime('%Y-%m')
        monthly_counts = recent_matches['year_month'].value_counts().sort_index()

        monthly_activity = []
        for year_month, count in monthly_counts.items():
            monthly_activity.append({
                'month': year_month,
                'matches': int(count)
            })

        return monthly_activity

    def _find_favourite_opponents(self, df: pd.DataFrame):
        if df.empty:
            return []

        opponents = list(zip(df['opponent_id'], df['opponent_name']))
        opponent_counts = Counter(opponents)

        if not opponent_counts:
            return []

        top_opponents = opponent_counts.most_common(5)

        favourite_opponents = []
        for (opponent_id, opponent_name), count in top_opponents:
            favourite_opponents.append({
                'id': int(opponent_id),
                'name': opponent_name,
                'matches': int(count)
            })

        return favourite_opponents

    def _find_favourite_leagues(self, df: pd.DataFrame):
        if df.empty:
            return []

        leagues = df['league'].apply(lambda league: (league['id'], league['name']))
        league_counts = Counter(leagues)

        if not league_counts:
            return []

        top_leagues = league_counts.most_common(5)

        favourite_leagues = []
        for (league_id, league_name), count in top_leagues:
            favourite_leagues.append({
                'id': int(league_id),
                'name': league_name,
                'matches': int(count)
            })

        return favourite_leagues

    def _find_top_goals_opponents(self, df: pd.DataFrame):
        if df.empty:
            return []

        grouped = (
            df.groupby(['opponent_id', 'opponent_name'])['team_goals']
            .sum()
            .reset_index()
            .sort_values(by='team_goals', ascending=False)
            .head(5)
        )

        top_goals = []
        for _, row in grouped.iterrows():
            top_goals.append({
                'id': int(row['opponent_id']),
                'name': row['opponent_name'],
                'goals': int(row['team_goals'])
            })

        return top_goals

    def _get_last_match_date(self, df: pd.DataFrame):
        if df.empty:
            return None

        latest_timestamp = df['fixture'].apply(lambda fixture: fixture['timestamp']).max()
        latest_date = datetime.fromtimestamp(latest_timestamp).strftime('%Y-%m-%d')
        return latest_date


