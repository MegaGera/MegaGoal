from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import pandas as pd
import os
from datetime import datetime, timedelta
from collections import Counter

class UserGeneralStatsAPIView(APIView):
    def get(self, request, *args, **kwargs):
        # Access the validation data added by the middleware
        validate_data = getattr(request, 'validateData', None)
        if validate_data:
            username = validate_data.get('data').get('username')
        else:
            username = os.getenv('USERNAME_DEV')

        if username is None:
            return Response({"error": "Username parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Use the MongoDB connection from settings
        collection_matches = settings.MONGO_DB['matches']
        
        # Get all matches for the user
        query = {
            '$and': [
                { 'user.username': username },
                { 'goals.home': { '$exists': True, '$ne': None } },
                { 'goals.away': { '$exists': True, '$ne': None } }
            ]
        }
        matches = list(collection_matches.find(query))
        
        if not matches:
            return Response({
                'totalMatches': 0,
                'matchesBySeason': [],
                'goalsPerMatch': 0,
                'favouriteTeams': [],
                'monthlyActivity': [],
                'favouriteLeagues': [],
                'topGoalsTeams': [],
                'totalGoals': 0,
                'lastMatchDate': None
            }, status=status.HTTP_200_OK)

        # Convert to DataFrame for easier analysis
        df = pd.DataFrame(matches)
        
        # Calculate basic stats
        total_matches = len(df)
        total_goals = df['goals'].apply(lambda x: x['home'] + x['away']).sum()
        goals_per_match = round(total_goals / total_matches, 1) if total_matches > 0 else 0
        
        # Calculate matches by season
        matches_by_season = self._calculate_matches_by_season(df)
        
        # Calculate monthly activity (last 12 months)
        monthly_activity = self._calculate_monthly_activity(df)
        
        # Find top 5 favourite teams
        favourite_teams = self._find_favourite_teams(df)
        
        # Find top 5 favourite leagues
        favourite_leagues = self._find_favourite_leagues(df)
        
        # Find top 5 teams with most goals scored
        top_goals_teams = self._find_top_goals_teams(df)
        
        # Get last match date
        last_match_date = self._get_last_match_date(df)
        
        return Response({
            'totalMatches': total_matches,
            'matchesBySeason': matches_by_season,
            'goalsPerMatch': goals_per_match,
            'favouriteTeams': favourite_teams,
            'monthlyActivity': monthly_activity,
            'favouriteLeagues': favourite_leagues,
            'topGoalsTeams': top_goals_teams,
            'totalGoals': total_goals,
            'lastMatchDate': last_match_date
        }, status=status.HTTP_200_OK)
    
    def _calculate_matches_by_season(self, df):
        """Calculate matches watched by season"""
        if df.empty:
            return []
        
        # Extract seasons and count matches
        seasons = df['league'].apply(lambda x: x['season'])
        season_counts = seasons.value_counts().sort_index(ascending=False)
        
        # Convert to list of objects and limit to last 5 seasons
        matches_by_season = []
        for season, count in season_counts.head(5).items():
            matches_by_season.append({
                'season': season,
                'matches': int(count)
            })
        
        return matches_by_season
    
    def _calculate_monthly_activity(self, df):
        """Calculate matches in the last 12 months"""
        if df.empty:
            return []
        
        # Convert timestamps to datetime
        df['match_date'] = pd.to_datetime(df['fixture'].apply(lambda x: x['timestamp']), unit='s')
        
        # Get date 12 months ago
        year_ago = datetime.now() - timedelta(days=365)
        
        # Filter matches from last 12 months
        recent_matches = df[df['match_date'] >= year_ago]
        
        if recent_matches.empty:
            return []
        
        # Group by year-month and count
        recent_matches['year_month'] = recent_matches['match_date'].dt.strftime('%Y-%m')
        monthly_counts = recent_matches['year_month'].value_counts().sort_index()
        
        # Convert to list of objects
        monthly_activity = []
        for year_month, count in monthly_counts.items():
            monthly_activity.append({
                'month': year_month,
                'matches': int(count)
            })
        
        return monthly_activity
    
    def _find_favourite_teams(self, df):
        """Find top 5 favourite teams"""
        if df.empty:
            return []
        
        # Extract home and away teams
        home_teams = df['teams'].apply(lambda x: (x['home']['id'], x['home']['name']))
        away_teams = df['teams'].apply(lambda x: (x['away']['id'], x['away']['name']))
        
        # Combine all teams
        all_teams = list(home_teams) + list(away_teams)
        
        # Count occurrences
        team_counts = Counter(all_teams)
        
        if not team_counts:
            return []
        
        # Get top 5 teams
        top_teams = team_counts.most_common(5)
        
        # Convert to list of objects
        favourite_teams = []
        for (team_id, team_name), count in top_teams:
            favourite_teams.append({
                'id': team_id,
                'name': team_name,
                'matches': count
            })
        
        return favourite_teams
    
    def _find_favourite_leagues(self, df):
        """Find top 5 favourite leagues"""
        if df.empty:
            return []
        
        # Extract leagues
        leagues = df['league'].apply(lambda x: (x['id'], x['name']))
        
        # Count occurrences
        league_counts = Counter(leagues)
        
        if not league_counts:
            return []
        
        # Get top 5 leagues
        top_leagues = league_counts.most_common(5)
        
        # Convert to list of objects
        favourite_leagues = []
        for (league_id, league_name), count in top_leagues:
            favourite_leagues.append({
                'id': league_id,
                'name': league_name,
                'matches': count
            })
        
        return favourite_leagues
    
    def _find_top_goals_teams(self, df):
        """Find top 5 teams with most goals scored"""
        if df.empty:
            return []
        
        # Create a dictionary to store goals for each team
        team_goals = {}
        
        # Iterate through matches to calculate goals for each team
        for _, match in df.iterrows():
            home_team_id = match['teams']['home']['id']
            home_team_name = match['teams']['home']['name']
            away_team_id = match['teams']['away']['id']
            away_team_name = match['teams']['away']['name']
            
            home_goals = match['goals']['home']
            away_goals = match['goals']['away']
            
            # Add goals for home team
            if home_team_id not in team_goals:
                team_goals[home_team_id] = {'id': home_team_id, 'name': home_team_name, 'goals': 0}
            team_goals[home_team_id]['goals'] += home_goals
            
            # Add goals for away team
            if away_team_id not in team_goals:
                team_goals[away_team_id] = {'id': away_team_id, 'name': away_team_name, 'goals': 0}
            team_goals[away_team_id]['goals'] += away_goals
        
        if not team_goals:
            return []
        
        # Sort teams by goals (descending) and get top 5
        top_goals_teams = sorted(team_goals.values(), key=lambda x: x['goals'], reverse=True)[:5]
        
        return top_goals_teams
    
    def _get_last_match_date(self, df):
        """Get the date of the last match"""
        if df.empty:
            return None
        
        # Get the most recent timestamp
        latest_timestamp = df['fixture'].apply(lambda x: x['timestamp']).max()
        
        # Convert to date string
        latest_date = datetime.fromtimestamp(latest_timestamp).strftime('%Y-%m-%d')
        
        return latest_date 