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
        location = request.query_params.get('location', '')

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

        # Location filter
        if location != '':
            filters.append({'location': location})

        # User filter
        filters.append({'user.username': username})

        # Build query
        if len(filters) > 0:
            query = {'$and': filters}
        else:
            query = {}

        # Use the MongoDB connection from settings
        collection_matches = settings.MONGO_DB['matches']
        collection_locations = settings.MONGO_DB['locations']
        favourite_team_matches = pd.DataFrame(list(collection_matches.find(query)))
        locations = pd.DataFrame(list(collection_locations.find({'user.username': username})))

        if len(favourite_team_matches) == 0:
            return Response(None, status=status.HTTP_200_OK)

        # Calculate stats for favourite team
        favourite_team_stats = self._calculate_favourite_team_stats(favourite_team_matches, team_id, locations)
        
        return Response(favourite_team_stats, status=status.HTTP_200_OK)

    def _calculate_favourite_team_stats(self, matches_df, team_id, locations_df):
        """Calculate comprehensive stats for the favourite team"""
        
        # Basic stats
        views_count = len(matches_df)
        goals_scored = 0
        goals_conceded = 0
        wins = 0
        draws = 0
        losses = 0

        # Calculate goals and results
        for _, match in matches_df.iterrows():
            is_home = match['teams']['home']['id'] == int(team_id)
            
            if is_home:
                goals_scored += match['goals']['home']
                goals_conceded += match['goals']['away']
                if match['goals']['home'] > match['goals']['away']:
                    wins += 1
                elif match['goals']['home'] < match['goals']['away']:
                    losses += 1
                else:
                    draws += 1
            else:
                goals_scored += match['goals']['away']
                goals_conceded += match['goals']['home']
                if match['goals']['away'] > match['goals']['home']:
                    wins += 1
                elif match['goals']['away'] < match['goals']['home']:
                    losses += 1
                else:
                    draws += 1

        # Calculate win rate
        total_matches = wins + draws + losses
        win_rate = round((wins / total_matches) * 100) if total_matches > 0 else 0

        # Find crazy match (highest total goals)
        matches_df['total_goals'] = matches_df.apply(lambda x: x['goals']['home'] + x['goals']['away'], axis=1)
        crazy_match_row = matches_df.loc[matches_df['total_goals'].idxmax()]
        crazy_match = self._format_match_for_response(crazy_match_row)

        # Find biggest rival (team played against most)
        rival_stats = self._find_biggest_rival(matches_df, team_id)

        # Calculate location-based stats
        location_stats = self._calculate_location_stats(matches_df, team_id, locations_df)

        # Get team name
        team_name = matches_df.iloc[0]['teams']['home']['name'] if matches_df.iloc[0]['teams']['home']['id'] == int(team_id) else matches_df.iloc[0]['teams']['away']['name']

        return {
            'team_id': int(team_id),
            'team_name': team_name,
            'views_count': int(views_count),
            'goals_scored': int(goals_scored),
            'goals_conceded': int(goals_conceded),
            'matches_watched': int(total_matches),
            'win_rate': int(win_rate),
            'crazy_match': crazy_match,
            'biggest_rival': rival_stats,
            'most_viewed_location': location_stats.get('most_viewed_location'),
            'home_stadium_times': location_stats.get('home_stadium_times'),
            'away_stadium_support': location_stats.get('away_stadium_support'),
            'total_away_stadium_visits': location_stats.get('total_away_stadium_visits')
        }

    def _calculate_location_stats(self, matches_df, team_id, locations_df):
        """Calculate location-based statistics"""
        location_stats = {}
        
        if len(matches_df) == 0 or len(locations_df) == 0:
            return location_stats

        # Create a mapping of location IDs to location names
        location_map = {}
        for _, location in locations_df.iterrows():
            location_map[location['id']] = location['name']

        # Count location views
        location_counts = {}
        home_stadium_counts = {}
        away_stadium_counts = {}
        total_away_stadium_visits = 0

        for _, match in matches_df.iterrows():
            location_id = match.get('location', '')
            if location_id and location_id in location_map:
                location_name = location_map[location_id]
                
                # Count general location views
                location_counts[location_name] = location_counts.get(location_name, 0) + 1
                
                # Check if team is home or away
                is_home = match['teams']['home']['id'] == int(team_id)
                
                # Check if location is a stadium
                location_row = locations_df[locations_df['id'] == location_id]
                if len(location_row) > 0 and location_row.iloc[0].get('stadium', False):
                    if is_home:
                        home_stadium_counts[location_name] = home_stadium_counts.get(location_name, 0) + 1
                    else:
                        away_stadium_counts[location_name] = away_stadium_counts.get(location_name, 0) + 1
                        total_away_stadium_visits += 1

        # Find most viewed location
        if location_counts:
            most_viewed_location_name = max(location_counts, key=location_counts.get)
            location_stats['most_viewed_location'] = {
                'location_name': most_viewed_location_name,
                'views_count': location_counts[most_viewed_location_name]
            }

        # Find most viewed home stadium
        if home_stadium_counts:
            most_viewed_home_stadium = max(home_stadium_counts, key=home_stadium_counts.get)
            location_stats['home_stadium_times'] = {
                'location_name': most_viewed_home_stadium,
                'views_count': home_stadium_counts[most_viewed_home_stadium]
            }

        # Find most viewed away stadium
        if away_stadium_counts:
            most_viewed_away_stadium = max(away_stadium_counts, key=away_stadium_counts.get)
            location_stats['away_stadium_support'] = {
                'location_name': most_viewed_away_stadium,
                'views_count': away_stadium_counts[most_viewed_away_stadium]
            }

        # Add total away stadium visits count
        location_stats['total_away_stadium_visits'] = total_away_stadium_visits

        return location_stats

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
            if match['teams']['home']['id'] == int(team_id):
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