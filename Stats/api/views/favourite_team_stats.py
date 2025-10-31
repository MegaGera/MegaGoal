from typing import Any
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

        # Exclude matches with null or missing goals
        filters.append({'goals.home': {'$exists': True, '$ne': None}})
        filters.append({'goals.away': {'$exists': True, '$ne': None}})

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

        # Player stats from events and lineups (only for this team)
        top_goalscorer = self._find_top_goalscorer(matches_df, team_id)
        top_assist_provider = self._find_top_assist_provider(matches_df, team_id)
        most_watched_player = self._find_most_watched_player(matches_df, team_id)

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
            'total_away_stadium_visits': location_stats.get('total_away_stadium_visits'),
            'top_goalscorer': top_goalscorer,
            'top_assist_provider': top_assist_provider,
            'most_watched_player': most_watched_player
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

    def _find_top_goalscorer(self, matches_df, team_id):
        """Find player with most goals for the favourite team - OPTIMIZED"""
        collection_real_matches = settings.MONGO_DB['real_matches']
        player_goals = {}
        
        # OPTIMIZATION 1: Batch fetch all real_matches with aggregation - filter by favourite team_id directly in MongoDB
        fixture_ids = matches_df['fixture'].apply(lambda x: x['id']).tolist()
        if not fixture_ids:
            return None
        
        # Single batch aggregation query - filter events by favourite team_id directly in MongoDB
        # Since all fixtures are for the same favourite team, we can use team_id directly
        pipeline = [
            {'$match': {'fixture.id': {'$in': fixture_ids}}},
            {'$project': {
                'fixture.id': 1,
                'events': {
                    '$filter': {
                        'input': {'$ifNull': ['$events', []]},
                        'as': 'event',
                        'cond': {
                            '$and': [
                                {'$eq': [{'$toLower': '$$event.type'}, 'goal']},
                                {'$eq': ['$$event.team.id', int(team_id)]}
                            ]
                        }
                    }
                }
            }}
        ]
        
        real_matches_dict = {
            rm['fixture']['id']: rm 
            for rm in collection_real_matches.aggregate(pipeline)
            if rm.get('events')
        }
        
        # OPTIMIZATION 2: Process events (already filtered by team_id in database)
        for fixture_id, real_match in real_matches_dict.items():
            events = real_match.get('events', [])
            # Track which players appeared in this match to count matches
            players_in_match = set()
            for event in events:
                # Events are already filtered by team_id, just extract player info
                player_id = event.get('player', {}).get('id')
                player_name = event.get('player', {}).get('name')
                
                if player_id and player_name:
                    if player_id not in player_goals:
                        player_goals[player_id] = {
                            'name': player_name,
                            'goals': 0,
                            'matches': 0
                        }
                    player_goals[player_id]['goals'] += 1
                    players_in_match.add(player_id)

            for player_id in players_in_match:
                player_goals[player_id]['matches'] += 1
        
        if not player_goals:
            return None
        
        # Find top goalscorer
        top_scorer = max(player_goals.values(), key=lambda x: x['goals'])
        top_scorer_id = next(k for k, v in player_goals.items() if v == top_scorer)
        
        return {
            'player_id': top_scorer_id,
            'player_name': top_scorer['name'],
            'goals': top_scorer['goals'],
            'matches': top_scorer['matches']
        }

    def _find_top_assist_provider(self, matches_df, team_id):
        """Find player with most assists for the favourite team - OPTIMIZED"""
        collection_real_matches = settings.MONGO_DB['real_matches']
        player_assists = {}
        
        # OPTIMIZATION 1: Batch fetch all real_matches in one query with projection
        fixture_ids = matches_df['fixture'].apply(lambda x: x['id']).tolist()
        if not fixture_ids:
            return None
        
        # Single batch aggregation query - filter events by favourite team_id directly in MongoDB
        # Since all fixtures are for the same favourite team, we can use team_id directly
        # Use aggregation to filter events by team_id at database level
        pipeline = [
            {'$match': {'fixture.id': {'$in': fixture_ids}}},
            {'$project': {
                'fixture.id': 1,
                'events': {
                    '$filter': {
                        'input': {'$ifNull': ['$events', []]},
                        'as': 'event',
                        'cond': {
                            '$and': [
                                {'$eq': [{'$toLower': '$$event.type'}, 'goal']},
                                {'$eq': ['$$event.team.id', int(team_id)]},
                                {'$ne': ['$$event.assist', None]}
                            ]
                        }
                    }
                }
            }}
        ]
        
        real_matches_dict = {
            rm['fixture']['id']: rm 
            for rm in collection_real_matches.aggregate(pipeline)
            if rm.get('events')
        }
        
        # OPTIMIZATION 2: Process events (already filtered by team_id in database)
        for fixture_id, real_match in real_matches_dict.items():
            events = real_match.get('events', [])
            # Track which players appeared in this match to count matches
            players_in_match = set()
            for event in events:
                # Events are already filtered by team_id and have assists, just extract assist info
                assist = event.get('assist')
                if assist and assist.get('id') and assist.get('name'):
                    player_id = assist['id']
                    player_name = assist['name']
                    
                    if player_id not in player_assists:
                        player_assists[player_id] = {
                            'name': player_name,
                            'assists': 0,
                            'matches': 0
                        }
                    players_in_match.add(player_id)
                    player_assists[player_id]['assists'] += 1

            for player_id in players_in_match:
                player_assists[player_id]['matches'] += 1

        
        if not player_assists:
            return None
        
        # Find top assist provider
        top_assist = max(player_assists.values(), key=lambda x: x['assists'])
        top_assist_id = next(k for k, v in player_assists.items() if v == top_assist)
        
        return {
            'player_id': top_assist_id,
            'player_name': top_assist['name'],
            'assists': top_assist['assists'],
            'matches': top_assist['matches']
        }

    def _find_most_watched_player(self, matches_df, team_id):
        """Find player from favourite team appearing in most matches - OPTIMIZED"""
        collection_real_matches = settings.MONGO_DB['real_matches']
        player_matches = {}
        
        # OPTIMIZATION 1: Batch fetch all real_matches with aggregation - filter by favourite team_id directly in MongoDB
        fixture_ids = matches_df['fixture'].apply(lambda x: x['id']).tolist()
        if not fixture_ids:
            return None
        
        # Single batch aggregation query - filter lineups and substitution events by favourite team_id directly in MongoDB
        # Since all fixtures are for the same favourite team, we can use team_id directly
        pipeline = [
            {'$match': {'fixture.id': {'$in': fixture_ids}}},
            {'$project': {
                'fixture.id': 1,
                'lineups': {
                    '$filter': {
                        'input': {'$ifNull': ['$lineups', []]},
                        'as': 'lineup',
                        'cond': {'$eq': ['$$lineup.team.id', int(team_id)]}
                    }
                },
                'events': {
                    '$filter': {
                        'input': {'$ifNull': ['$events', []]},
                        'as': 'event',
                        'cond': {
                            '$and': [
                                {'$eq': ['$$event.team.id', int(team_id)]},
                                {'$eq': [{'$toLower': '$$event.type'}, 'subst']},
                                {'$ne': ['$$event.assist', None]}
                            ]
                        }
                    }
                }
            }}
        ]
        
        real_matches_dict = {
            rm['fixture']['id']: rm 
            for rm in collection_real_matches.aggregate(pipeline)
        }
        
        # OPTIMIZATION 2: Process lineups and events (already filtered by team_id in database)
        for fixture_id, real_match in real_matches_dict.items():
            # Track which players appeared in this match to count matches
            players_in_match = set()
            # Track which players started in startXI
            players_started = set()
            
            # Count players from startXI only (not substitutes from lineup)
            if 'lineups' in real_match and real_match['lineups']:
                for lineup in real_match['lineups']:
                    # Count startXI players
                    if 'startXI' in lineup:
                        for player_info in lineup['startXI']:
                            player_id = player_info.get('player', {}).get('id')
                            player_name = player_info.get('player', {}).get('name')
                            if player_id and player_name:
                                if player_id not in player_matches:
                                    player_matches[player_id] = {
                                        'name': player_name,
                                        'matches': 0,
                                        'startXI_matches': 0
                                    }
                                players_in_match.add(player_id)
                                players_started.add(player_id)
            
            # Count players from substitution events (event.type == "subst")
            # The player that enters is in event.assist
            if 'events' in real_match and real_match['events']:
                for event in real_match['events']:
                    # Only process substitution events
                    if event.get('type', '').lower() == 'subst':
                        assist = event.get('assist')  # Player entering the game
                        if assist and assist.get('id') and assist.get('name'):
                            player_id = assist['id']
                            player_name = assist['name']
                            if player_id not in player_matches:
                                player_matches[player_id] = {
                                    'name': player_name,
                                    'matches': 0,
                                    'startXI_matches': 0
                                }
                            players_in_match.add(player_id)
            
            # Increment match count for all players that appeared in this match
            for player_id in players_in_match:
                player_matches[player_id]['matches'] += 1
            
            # Increment startXI match count for players that started
            for player_id in players_started:
                player_matches[player_id]['startXI_matches'] += 1
        
        if not player_matches:
            return None
        
        # Find most watched player
        most_watched = max(player_matches.values(), key=lambda x: x['matches'])
        most_watched_id = next(k for k, v in player_matches.items() if v == most_watched)
        
        return {
            'player_id': most_watched_id,
            'player_name': most_watched['name'],
            'matches': most_watched['matches'],
            'startXI_matches': most_watched['startXI_matches']
        } 