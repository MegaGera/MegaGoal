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
        player_insights = self._collect_player_insights(matches_df, team_id)
        top_goalscorer = player_insights.get('top_goalscorer')
        top_assist_provider = player_insights.get('top_assist_provider')
        most_watched_player = player_insights.get('most_watched_player')
        goalscorers = player_insights.get('goalscorers', [])
        assist_providers = player_insights.get('assist_providers', [])
        watched_players = player_insights.get('watched_players', [])
        team_totals = player_insights.get('team_totals', {})

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
            'most_watched_player': most_watched_player,
            'goalscorers': goalscorers,
            'assist_providers': assist_providers,
            'watched_players': watched_players,
            'total_yellow_cards': team_totals.get('yellow_cards'),
            'total_red_cards': team_totals.get('red_cards'),
            'total_fouls': team_totals.get('fouls'),
            'average_possession': team_totals.get('average_possession'),
            'total_corner_kicks': team_totals.get('corner_kicks')
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

    def _collect_player_insights(self, matches_df, team_id):
        """Aggregate player goals, assists, and appearances in a single pass."""
        fixture_ids = matches_df['fixture'].apply(lambda x: x['id']).tolist()
        if not fixture_ids:
            return {
                'top_goalscorer': None,
                'top_assist_provider': None,
                'most_watched_player': None,
                'goalscorers': [],
                'assist_providers': [],
                'watched_players': []
            }

        collection_real_matches = settings.MONGO_DB['real_matches']
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
                'substitution_events': {
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
                },
                'goal_events': {
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
                },
                'card_events': {
                    '$filter': {
                        'input': {'$ifNull': ['$events', []]},
                        'as': 'event',
                        'cond': {
                            '$and': [
                                {'$eq': ['$$event.team.id', int(team_id)]},
                                {'$eq': [{'$toLower': '$$event.type'}, 'card']}
                            ]
                        }
                    }
                },
                'team_statistics': {
                    '$filter': {
                        'input': {'$ifNull': ['$statistics', []]},
                        'as': 'team_stats',
                        'cond': {'$eq': ['$$team_stats.team.id', int(team_id)]}
                    }
                }
            }}
        ]

        real_matches = list(collection_real_matches.aggregate(pipeline))
        if not real_matches:
            return {
                'top_goalscorer': None,
                'top_assist_provider': None,
                'most_watched_player': None,
                'goalscorers': [],
                'assist_providers': [],
                'watched_players': []
            }

        def _ensure_player_entry(container, player_id, player_name):
            if player_id not in container:
                container[player_id] = {
                    'name': player_name,
                    'goals': 0,
                    'assists': 0,
                    'matches': 0,
                    'startXI_matches': 0
                }
            return container[player_id]

        player_stats = {}
        total_yellow_cards = 0
        total_red_cards = 0
        total_fouls = 0
        total_corner_kicks = 0
        possession_total = 0.0
        possession_matches = 0

        for real_match in real_matches:
            players_in_match = set()
            players_started = set()

            for lineup in real_match.get('lineups', []):
                for player_info in lineup.get('startXI', []):
                    player = player_info.get('player', {})
                    player_id = player.get('id')
                    player_name = player.get('name')
                    if player_id and player_name:
                        _ensure_player_entry(player_stats, player_id, player_name)
                        players_in_match.add(player_id)
                        players_started.add(player_id)

            for event in real_match.get('substitution_events', []):
                assist = event.get('assist', {})
                player_id = assist.get('id')
                player_name = assist.get('name')
                if player_id and player_name:
                    _ensure_player_entry(player_stats, player_id, player_name)
                    players_in_match.add(player_id)

            for event in real_match.get('goal_events', []):
                scorer = event.get('player', {})
                scorer_id = scorer.get('id')
                scorer_name = scorer.get('name')
                if scorer_id and scorer_name:
                    player_entry = _ensure_player_entry(player_stats, scorer_id, scorer_name)
                    player_entry['goals'] += 1
                    players_in_match.add(scorer_id)

                assist = event.get('assist', {})
                assist_id = assist.get('id')
                assist_name = assist.get('name')
                if assist_id and assist_name:
                    assist_entry = _ensure_player_entry(player_stats, assist_id, assist_name)
                    assist_entry['assists'] += 1
                    players_in_match.add(assist_id)

            for event in real_match.get('card_events', []):
                detail = (event.get('detail') or '').lower()
                if 'red' in detail:
                    total_red_cards += 1
                elif 'yellow' in detail:
                    total_yellow_cards += 1

            for team_stat in real_match.get('team_statistics', []):
                for stat in team_stat.get('statistics', []):
                    stat_type = (stat.get('type') or '').lower()
                    value = stat.get('value')

                    numeric_value = None
                    if isinstance(value, (int, float)):
                        numeric_value = float(value)
                    elif isinstance(value, str):
                        stripped = value.strip()
                        if stripped.endswith('%'):
                            stripped = stripped[:-1].strip()
                        try:
                            numeric_value = float(stripped)
                        except ValueError:
                            numeric_value = None

                    if 'possession' in stat_type and numeric_value is not None:
                        possession_total += numeric_value
                        possession_matches += 1
                    elif ('foul' in stat_type or 'fault' in stat_type) and numeric_value is not None:
                        total_fouls += numeric_value
                    elif 'corner' in stat_type and numeric_value is not None:
                        total_corner_kicks += numeric_value

            for player_id in players_in_match:
                player_stats[player_id]['matches'] += 1

            for player_id in players_started:
                player_stats[player_id]['startXI_matches'] += 1

        if not player_stats:
            return {
                'top_goalscorer': None,
                'top_assist_provider': None,
                'most_watched_player': None,
                'goalscorers': [],
                'assist_providers': [],
                'watched_players': []
            }

        def _sorted_projection(filter_fn, key_name):
            items = [
                {
                    'player_id': player_id,
                    'player_name': stats['name'],
                    key_name: stats[key_name],
                    'matches': stats['matches']
                }
                for player_id, stats in player_stats.items()
                if filter_fn(stats)
            ]
            items.sort(key=lambda x: (-x[key_name], -x['matches'], x['player_name']))
            return items

        goalscorers = _sorted_projection(lambda stats: stats['goals'] > 0, 'goals')
        assist_providers = _sorted_projection(lambda stats: stats['assists'] > 0, 'assists')
        watched_players = [
            {
                'player_id': player_id,
                'player_name': stats['name'],
                'matches': stats['matches'],
                'startXI_matches': stats['startXI_matches']
            }
            for player_id, stats in player_stats.items()
            if stats['matches'] > 0
        ]
        watched_players.sort(key=lambda x: (-x['matches'], -x['startXI_matches'], x['player_name']))

        top_goalscorer = None
        top_assist_provider = None
        most_watched_player = None

        if player_stats:
            top_scorer_id, top_scorer_stats = max(player_stats.items(), key=lambda item: item[1]['goals'])
            if top_scorer_stats['goals'] > 0:
                top_goalscorer = {
                    'player_id': top_scorer_id,
                    'player_name': top_scorer_stats['name'],
                    'goals': top_scorer_stats['goals'],
                    'matches': top_scorer_stats['matches']
                }

            top_assist_id, top_assist_stats = max(player_stats.items(), key=lambda item: item[1]['assists'])
            if top_assist_stats['assists'] > 0:
                top_assist_provider = {
                    'player_id': top_assist_id,
                    'player_name': top_assist_stats['name'],
                    'assists': top_assist_stats['assists'],
                    'matches': top_assist_stats['matches']
                }

            top_watched_id, top_watched_stats = max(player_stats.items(), key=lambda item: item[1]['matches'])
            if top_watched_stats['matches'] > 0:
                most_watched_player = {
                    'player_id': top_watched_id,
                    'player_name': top_watched_stats['name'],
                    'matches': top_watched_stats['matches'],
                    'startXI_matches': top_watched_stats['startXI_matches']
                }

        team_totals = {
            'yellow_cards': int(total_yellow_cards),
            'red_cards': int(total_red_cards),
            'fouls': int(total_fouls),
            'corner_kicks': int(total_corner_kicks),
            'average_possession': round(possession_total / possession_matches, 2) if possession_matches else None
        }

        return {
            'top_goalscorer': top_goalscorer,
            'top_assist_provider': top_assist_provider,
            'most_watched_player': most_watched_player,
            'goalscorers': goalscorers,
            'assist_providers': assist_providers,
            'watched_players': watched_players,
            'team_totals': team_totals
        }