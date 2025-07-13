from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import pandas as pd
import os
from datetime import datetime

class GeneralStatsAPIView(APIView):
    def get(self, request, *args, **kwargs):
        # Access the validation data added by the middleware
        validate_data = getattr(request, 'validateData', None)
        if validate_data:
            username = validate_data.get('data').get('username')
        else:
            username = os.getenv('USERNAME_DEV')

        leagues = request.query_params.get('leagues', '')
        season = request.query_params.get('season', '0')

        if username is None:
            return Response({"error": "Username parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Parse leagues parameter
        leagues_array = [int(num) for num in leagues.split(',') if num.strip()] if leagues else []

        # Build filters
        filters = []
        
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
        collection_locations = settings.MONGO_DB['locations']
        matches = pd.DataFrame(list(collection_matches.find(query)))
        locations = pd.DataFrame(list(collection_locations.find({'user.username': username})))

        if len(matches) == 0:
            return Response({}, status=status.HTTP_200_OK)

        # Calculate general stats
        general_stats = self._calculate_general_stats(matches, locations)
        
        return Response(general_stats, status=status.HTTP_200_OK)

    def _calculate_general_stats(self, matches_df, locations_df):
        """Calculate general statistics based on matches and locations"""
        
        # Calculate total goals for each match
        matches_df['total_goals'] = matches_df.apply(lambda x: x['goals']['home'] + x['goals']['away'], axis=1)
        matches_df['goal_diff'] = matches_df.apply(lambda x: abs(x['goals']['home'] - x['goals']['away']), axis=1)
        
        # King of draws (team with most draws)
        draw_stats = self._find_king_of_draws(matches_df)
        
        # Crazy Match (match with most total goals)
        crazy_match = self._find_crazy_match(matches_df)
        
        # Biggest win % (team with highest win percentage)
        biggest_win_percentage = self._find_biggest_win_percentage(matches_df)
        
        # Biggest lose % (team with highest loss percentage)
        biggest_lose_percentage = self._find_biggest_lose_percentage(matches_df)
        
        # Most boring team (lowest average goals per match)
        most_boring_team = self._find_most_boring_team(matches_df)
        
        # Most crazy team (highest average goals per match)
        most_crazy_team = self._find_most_crazy_team(matches_df)
        
        # Most watched location
        most_watched_location = self._find_most_watched_location(matches_df, locations_df)
        
        # Most watched stadium location
        most_watched_stadium = self._find_most_watched_stadium(matches_df, locations_df)

        return {
            'king_of_draws': draw_stats,
            'crazy_match': crazy_match,
            'biggest_win_percentage': biggest_win_percentage,
            'biggest_lose_percentage': biggest_lose_percentage,
            'most_boring_team': most_boring_team,
            'most_crazy_team': most_crazy_team,
            'most_watched_location': most_watched_location,
            'most_watched_stadium': most_watched_stadium
        }

    def _find_king_of_draws(self, matches_df):
        """Find the team with highest draw percentage"""
        team_stats = {}
        
        for _, match in matches_df.iterrows():
            home_team_id = match['teams']['home']['id']
            away_team_id = match['teams']['away']['id']
            home_team_name = match['teams']['home']['name']
            away_team_name = match['teams']['away']['name']
            
            # Initialize team stats if not exists
            if home_team_id not in team_stats:
                team_stats[home_team_id] = {'name': home_team_name, 'draws': 0, 'total': 0}
            if away_team_id not in team_stats:
                team_stats[away_team_id] = {'name': away_team_name, 'draws': 0, 'total': 0}
            
            # Count matches and draws
            team_stats[home_team_id]['total'] += 1
            team_stats[away_team_id]['total'] += 1
            
            if match['goals']['home'] == match['goals']['away']:
                team_stats[home_team_id]['draws'] += 1
                team_stats[away_team_id]['draws'] += 1
        
        if not team_stats:
            return None
            
        # Calculate draw percentages and filter teams with at least 3 matches
        valid_teams = {}
        for team_id, stats in team_stats.items():
            if stats['total'] >= 3:  # Minimum 3 matches requirement
                if stats['total'] > 0:
                    stats['draw_percentage'] = round((stats['draws'] / stats['total']) * 100)
                else:
                    stats['draw_percentage'] = 0
                valid_teams[team_id] = stats
        
        if not valid_teams:
            return None
            
        # Find team with highest draw percentage
        max_draw_team = max(valid_teams.values(), key=lambda x: x['draw_percentage'])
        return {
            'team_id': next(k for k, v in valid_teams.items() if v == max_draw_team),
            'team_name': max_draw_team['name'],
            'draw_percentage': max_draw_team['draw_percentage'],
            'draws_count': max_draw_team['draws'],
            'total_matches': max_draw_team['total']
        }

    def _find_crazy_match(self, matches_df):
        """Find the match with most total goals"""
        if len(matches_df) == 0:
            return None
            
        crazy_match_row = matches_df.loc[matches_df['total_goals'].idxmax()]
        return self._format_match_for_response(crazy_match_row)

    def _find_biggest_win_percentage(self, matches_df):
        """Find team with highest win percentage"""
        team_stats = {}
        
        for _, match in matches_df.iterrows():
            home_team_id = match['teams']['home']['id']
            away_team_id = match['teams']['away']['id']
            home_team_name = match['teams']['home']['name']
            away_team_name = match['teams']['away']['name']
            
            # Initialize team stats if not exists
            if home_team_id not in team_stats:
                team_stats[home_team_id] = {'name': home_team_name, 'wins': 0, 'total': 0}
            if away_team_id not in team_stats:
                team_stats[away_team_id] = {'name': away_team_name, 'wins': 0, 'total': 0}
            
            # Count matches and wins
            team_stats[home_team_id]['total'] += 1
            team_stats[away_team_id]['total'] += 1
            
            if match['goals']['home'] > match['goals']['away']:
                team_stats[home_team_id]['wins'] += 1
            elif match['goals']['away'] > match['goals']['home']:
                team_stats[away_team_id]['wins'] += 1
        
        if not team_stats:
            return None
            
        # Calculate win percentages and filter teams with at least 3 matches
        valid_teams = {}
        for team_id, stats in team_stats.items():
            if stats['total'] >= 3:  # Minimum 3 matches requirement
                if stats['total'] > 0:
                    stats['win_percentage'] = round((stats['wins'] / stats['total']) * 100)
                else:
                    stats['win_percentage'] = 0
                valid_teams[team_id] = stats
        
        if not valid_teams:
            return None
            
        # Find team with highest win percentage
        max_win_team = max(valid_teams.values(), key=lambda x: x['win_percentage'])
        return {
            'team_id': next(k for k, v in valid_teams.items() if v == max_win_team),
            'team_name': max_win_team['name'],
            'win_percentage': max_win_team['win_percentage'],
            'wins': max_win_team['wins'],
            'total_matches': max_win_team['total']
        }

    def _find_biggest_lose_percentage(self, matches_df):
        """Find team with highest loss percentage"""
        team_stats = {}
        
        for _, match in matches_df.iterrows():
            home_team_id = match['teams']['home']['id']
            away_team_id = match['teams']['away']['id']
            home_team_name = match['teams']['home']['name']
            away_team_name = match['teams']['away']['name']
            
            # Initialize team stats if not exists
            if home_team_id not in team_stats:
                team_stats[home_team_id] = {'name': home_team_name, 'losses': 0, 'total': 0}
            if away_team_id not in team_stats:
                team_stats[away_team_id] = {'name': away_team_name, 'losses': 0, 'total': 0}
            
            # Count matches and losses
            team_stats[home_team_id]['total'] += 1
            team_stats[away_team_id]['total'] += 1
            
            if match['goals']['home'] < match['goals']['away']:
                team_stats[home_team_id]['losses'] += 1
            elif match['goals']['away'] < match['goals']['home']:
                team_stats[away_team_id]['losses'] += 1
        
        if not team_stats:
            return None
            
        # Calculate loss percentages and filter teams with at least 3 matches
        valid_teams = {}
        for team_id, stats in team_stats.items():
            if stats['total'] >= 3:  # Minimum 3 matches requirement
                if stats['total'] > 0:
                    stats['loss_percentage'] = round((stats['losses'] / stats['total']) * 100)
                else:
                    stats['loss_percentage'] = 0
                valid_teams[team_id] = stats
        
        if not valid_teams:
            return None
            
        # Find team with highest loss percentage
        max_loss_team = max(valid_teams.values(), key=lambda x: x['loss_percentage'])
        return {
            'team_id': next(k for k, v in valid_teams.items() if v == max_loss_team),
            'team_name': max_loss_team['name'],
            'loss_percentage': max_loss_team['loss_percentage'],
            'losses': max_loss_team['losses'],
            'total_matches': max_loss_team['total']
        }

    def _find_most_boring_team(self, matches_df):
        """Find team with lowest average goals per match"""
        team_goals = {}
        
        for _, match in matches_df.iterrows():
            home_team_id = match['teams']['home']['id']
            away_team_id = match['teams']['away']['id']
            home_team_name = match['teams']['home']['name']
            away_team_name = match['teams']['away']['name']
            
            # Initialize team stats if not exists
            if home_team_id not in team_goals:
                team_goals[home_team_id] = {'name': home_team_name, 'total_goals': 0, 'matches': 0}
            if away_team_id not in team_goals:
                team_goals[away_team_id] = {'name': away_team_name, 'total_goals': 0, 'matches': 0}
            
            # Add goals for this match
            match_goals = match['goals']['home'] + match['goals']['away']
            team_goals[home_team_id]['total_goals'] += match_goals
            team_goals[away_team_id]['total_goals'] += match_goals
            team_goals[home_team_id]['matches'] += 1
            team_goals[away_team_id]['matches'] += 1
        
        if not team_goals:
            return None
            
        # Calculate average goals per match and filter teams with at least 3 matches
        valid_teams = {}
        for team_id, stats in team_goals.items():
            if stats['matches'] >= 3:  # Minimum 3 matches requirement
                if stats['matches'] > 0:
                    stats['avg_goals'] = round(stats['total_goals'] / stats['matches'], 1)
                else:
                    stats['avg_goals'] = 0
                valid_teams[team_id] = stats
        
        if not valid_teams:
            return None
            
        # Find team with lowest average goals
        min_goals_team = min(valid_teams.values(), key=lambda x: x['avg_goals'])
        return {
            'team_id': next(k for k, v in valid_teams.items() if v == min_goals_team),
            'team_name': min_goals_team['name'],
            'avg_goals_per_match': min_goals_team['avg_goals'],
            'total_goals': min_goals_team['total_goals'],
            'matches': min_goals_team['matches']
        }

    def _find_most_crazy_team(self, matches_df):
        """Find team with highest average goals per match"""
        team_goals = {}
        
        for _, match in matches_df.iterrows():
            home_team_id = match['teams']['home']['id']
            away_team_id = match['teams']['away']['id']
            home_team_name = match['teams']['home']['name']
            away_team_name = match['teams']['away']['name']
            
            # Initialize team stats if not exists
            if home_team_id not in team_goals:
                team_goals[home_team_id] = {'name': home_team_name, 'total_goals': 0, 'matches': 0}
            if away_team_id not in team_goals:
                team_goals[away_team_id] = {'name': away_team_name, 'total_goals': 0, 'matches': 0}
            
            # Add goals for this match
            match_goals = match['goals']['home'] + match['goals']['away']
            team_goals[home_team_id]['total_goals'] += match_goals
            team_goals[away_team_id]['total_goals'] += match_goals
            team_goals[home_team_id]['matches'] += 1
            team_goals[away_team_id]['matches'] += 1
        
        if not team_goals:
            return None
            
        # Calculate average goals per match and filter teams with at least 3 matches
        valid_teams = {}
        for team_id, stats in team_goals.items():
            if stats['matches'] >= 3:  # Minimum 3 matches requirement
                if stats['matches'] > 0:
                    stats['avg_goals'] = round(stats['total_goals'] / stats['matches'], 1)
                else:
                    stats['avg_goals'] = 0
                valid_teams[team_id] = stats
        
        if not valid_teams:
            return None
            
        # Find team with highest average goals
        max_goals_team = max(valid_teams.values(), key=lambda x: x['avg_goals'])
        return {
            'team_id': next(k for k, v in valid_teams.items() if v == max_goals_team),
            'team_name': max_goals_team['name'],
            'avg_goals_per_match': max_goals_team['avg_goals'],
            'total_goals': max_goals_team['total_goals'],
            'matches': max_goals_team['matches']
        }

    def _find_most_watched_location(self, matches_df, locations_df):
        """Find most watched location"""
        if len(matches_df) == 0 or len(locations_df) == 0:
            return None
            
        # Create location mapping
        location_map = {}
        for _, location in locations_df.iterrows():
            location_map[location['id']] = location['name']
        
        # Count location views
        location_counts = {}
        for _, match in matches_df.iterrows():
            location_id = match.get('location', '')
            if location_id and location_id in location_map:
                location_name = location_map[location_id]
                location_counts[location_name] = location_counts.get(location_name, 0) + 1
        
        if not location_counts:
            return None
            
        # Find most watched location
        most_watched_location = max(location_counts, key=location_counts.get)
        return {
            'location_name': most_watched_location,
            'views_count': location_counts[most_watched_location]
        }

    def _find_most_watched_stadium(self, matches_df, locations_df):
        """Find most watched stadium location"""
        if len(matches_df) == 0 or len(locations_df) == 0:
            return None
            
        # Create location mapping
        location_map = {}
        for _, location in locations_df.iterrows():
            location_map[location['id']] = location['name']
        
        # Count stadium location views
        stadium_counts = {}
        for _, match in matches_df.iterrows():
            location_id = match.get('location', '')
            if location_id and location_id in location_map:
                # Check if location is a stadium
                location_row = locations_df[locations_df['id'] == location_id]
                if len(location_row) > 0 and location_row.iloc[0].get('stadium', False):
                    location_name = location_map[location_id]
                    stadium_counts[location_name] = stadium_counts.get(location_name, 0) + 1
        
        if not stadium_counts:
            return None
            
        # Find most watched stadium
        most_watched_stadium = max(stadium_counts, key=stadium_counts.get)
        return {
            'location_name': most_watched_stadium,
            'views_count': stadium_counts[most_watched_stadium]
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