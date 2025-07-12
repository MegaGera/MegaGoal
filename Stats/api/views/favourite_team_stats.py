from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import pandas as pd
import os
from datetime import datetime

class FavouriteTeamStatsAPIView(APIView):
    def get(self, request, *args, **kwargs):
        # Access the validation data added by the middleware
        validate_data = getattr(request, 'validateData', None)
        if validate_data:
            username = validate_data.get('data').get('username')
        else:
            username = os.getenv('USERNAME_DEV')

        team_id = request.query_params.get('team_id', None)
        leagues = request.query_params.get('leagues', '')
        season = request.query_params.get('season', '0')

        if username is None:
            return Response({"error": "Username parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        if team_id is None:
            return Response({"error": "Team ID parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Parse leagues parameter
        leagues_array = [int(num) for num in leagues.split(',') if num.strip()] if leagues else []

        # Build filters
        filters = []
        
        # Team type filter
        if team_id:
            filters.append({
                '$or': [
                    { 'teams.home.id': int(team_id) },
                    { 'teams.away.id': int(team_id) }
                ]
            })

        # League filter
        if leagues_array:
            filters.append({
                'league.id': {'$in': leagues_array}
            })

        # Season filter
        if season != '0':
            filters.append({'league.season': int(season)})

        # User filter
        filters.append({'user.username': username})

        # Build query
        if len(filters) > 0:
            query = {'$and': filters}
        else:
            query = {}

        # Use the MongoDB connection from settings
        collection_matches = settings.MONGO_DB['matches']
        favourite_team_matches = pd.DataFrame(list(collection_matches.find(query)))

        # if len(df) == 0:
        #     return Response(None, status=status.HTTP_200_OK)

        # # Get the most viewed team
        # home_teams = df.apply(lambda x: (x['teams']['home']['id'], x['teams']['home']['name'], x['goals']['home']), axis=1)
        # away_teams = df.apply(lambda x: (x['teams']['away']['id'], x['teams']['away']['name'], x['goals']['away']), axis=1)
        
        # all_teams = pd.concat([home_teams, away_teams], ignore_index=True)
        # all_teams_df = pd.DataFrame(all_teams.tolist(), columns=['team_id', 'team_name', 'goals'])
        
        # team_stats_df = all_teams_df.groupby(['team_id', 'team_name']).agg({
        #     'team_id': 'count', 
        #     'goals': 'sum'
        # }).rename(columns={'team_id': 'count'}).reset_index()
        
        # team_stats_df = team_stats_df.sort_values(by='count', ascending=False)
        
        # if len(team_stats_df) == 0:
        #     return Response(None, status=status.HTTP_200_OK)

        # # Get the most viewed team
        # favourite_team = team_stats_df.iloc[0]
        # favourite_team_id = favourite_team['team_id']
        # # favourite_team_name = favourite_team['team_name']

        # # Filter matches for the favourite team
        # favourite_team_matches = df[
        #     (df.apply(lambda x: x['teams']['home']['id'], axis=1) == int(favourite_team_id)) | 
        #     (df.apply(lambda x: x['teams']['away']['id'], axis=1) == int(favourite_team_id))
        # ].copy()

        if len(favourite_team_matches) == 0:
            return Response(None, status=status.HTTP_200_OK)

        # Calculate stats for favourite team
        favourite_team_stats = self._calculate_favourite_team_stats(favourite_team_matches, team_id)
        
        return Response(favourite_team_stats, status=status.HTTP_200_OK)

    def _calculate_favourite_team_stats(self, matches_df, team_id):
        """Calculate comprehensive stats for the favourite team"""
        
        # Basic stats
        views_count = len(matches_df)
        goals_scored = 0
        goals_conceded = 0
        wins = 0
        draws = 0
        losses = 0
        recent_results = []

        # Calculate goals and results
        for _, match in matches_df.iterrows():
            is_home = match['teams']['home']['id'] == team_id
            
            if is_home:
                goals_scored += match['goals']['home']
                goals_conceded += match['goals']['away']
                if match['goals']['home'] > match['goals']['away']:
                    wins += 1
                    recent_results.append('W')
                elif match['goals']['home'] < match['goals']['away']:
                    losses += 1
                    recent_results.append('L')
                else:
                    draws += 1
                    recent_results.append('D')
            else:
                goals_scored += match['goals']['away']
                goals_conceded += match['goals']['home']
                if match['goals']['away'] > match['goals']['home']:
                    wins += 1
                    recent_results.append('W')
                elif match['goals']['away'] < match['goals']['home']:
                    losses += 1
                    recent_results.append('L')
                else:
                    draws += 1
                    recent_results.append('D')

        # Calculate win rate
        total_matches = wins + draws + losses
        win_rate = round((wins / total_matches) * 100) if total_matches > 0 else 0

        # Find crazy match (highest total goals)
        matches_df['total_goals'] = matches_df.apply(lambda x: x['goals']['home'] + x['goals']['away'], axis=1)
        crazy_match_row = matches_df.loc[matches_df['total_goals'].idxmax()]
        crazy_match = self._format_match_for_response(crazy_match_row)

        # Find biggest rival (team played against most)
        rival_stats = self._find_biggest_rival(matches_df, team_id)

        # Get team name
        team_name = matches_df.iloc[0]['teams']['home']['name'] if matches_df.iloc[0]['teams']['home']['id'] == team_id else matches_df.iloc[0]['teams']['away']['name']

        return {
            'team_id': int(team_id),
            'team_name': team_name,
            'views_count': int(views_count),
            'goals_scored': int(goals_scored),
            'goals_conceded': int(goals_conceded),
            'matches_watched': int(total_matches),
            'win_rate': int(win_rate),
            'crazy_match': crazy_match,
            'biggest_rival': rival_stats
        }

    def _format_match_for_response(self, match_row):
        """Format a match row for API response"""
        return {
            '_id': str(match_row.get('_id', '')),
            'fixture': {
                'id': match_row['fixture']['id'],
                'timestamp': match_row['fixture']['timestamp']
            },
            'league': {
                'id': match_row['league']['id'],
                'name': match_row['league']['name'],
                'round': match_row['league']['round'],
                'season': match_row['league']['season']
            },
            'teams': {
                'home': {
                    'id': match_row['teams']['home']['id'],
                    'name': match_row['teams']['home']['name']
                },
                'away': {
                    'id': match_row['teams']['away']['id'],
                    'name': match_row['teams']['away']['name']
                }
            },
            'goals': {
                'home': match_row['goals']['home'],
                'away': match_row['goals']['away']
            },
            'location': match_row.get('location', ''),
            'status': match_row.get('status', '')
        }

    def _find_biggest_rival(self, matches_df, team_id):
        """Find the team that the favourite team has played against most"""
        rival_matches = []
        
        for _, match in matches_df.iterrows():
            if match['teams']['home']['id'] == team_id:
                rival_matches.append(match['teams']['away']['id'])
            else:
                rival_matches.append(match['teams']['home']['id'])

        if not rival_matches:
            return None

        # Count occurrences
        rival_counts = pd.Series(rival_matches).value_counts()
        biggest_rival_id = rival_counts.index[0]
        matches_played = rival_counts.iloc[0]

        # Get rival team name from any match
        rival_match = matches_df[
            (matches_df.apply(lambda x: x['teams']['home']['id'], axis=1) == biggest_rival_id) | 
            (matches_df.apply(lambda x: x['teams']['away']['id'], axis=1) == biggest_rival_id)
        ].iloc[0]

        rival_name = rival_match['teams']['home']['name'] if rival_match['teams']['home']['id'] == biggest_rival_id else rival_match['teams']['away']['name']

        return {
            'team_id': int(biggest_rival_id),
            'team_name': rival_name,
            'matches_played': int(matches_played)
        } 