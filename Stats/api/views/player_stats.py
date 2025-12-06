from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from datetime import datetime
import pandas as pd
import numpy as np
import os

class PlayerStatsAPIView(APIView):
    def _sanitize_value(self, value):
        """Convert NaN, Infinity, and other non-JSON-compliant values to None or 0"""
        if isinstance(value, float):
            if np.isnan(value) or np.isinf(value):
                return None
        return value
    
    def _sanitize_dict(self, data):
        """Recursively sanitize dictionary values for JSON serialization"""
        if isinstance(data, dict):
            return {key: self._sanitize_dict(value) for key, value in data.items()}
        elif isinstance(data, list):
            return [self._sanitize_dict(item) for item in data]
        else:
            return self._sanitize_value(data)
    
    def get(self, request, *args, **kwargs):
        # Access the validation data added by the middleware
        validate_data = getattr(request, 'validateData', None)
        if validate_data:
            username = validate_data.get('data').get('username')
        else:
            username = os.getenv('USERNAME_DEV')

        player_id = request.query_params.get('player_id', None)

        if username is None:
            return Response({"error": "Username parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        if player_id is None:
            return Response({"error": "Player ID parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            player_id = int(player_id)
        except ValueError:
            return Response({"error": "Invalid player ID"}, status=status.HTTP_400_BAD_REQUEST)

        # Get all matches watched by the user
        collection_matches = settings.MONGO_DB['matches']
        user_matches_query = {'user.username': username}
        user_matches = pd.DataFrame(list(collection_matches.find(user_matches_query)))

        if len(user_matches) == 0:
            return Response(None, status=status.HTTP_200_OK)

        # Get fixture IDs from user matches
        fixture_ids = user_matches['fixture'].apply(lambda x: x['id']).tolist()

        # Calculate player stats
        player_stats = self._calculate_player_stats(fixture_ids, player_id, user_matches)
        
        # Sanitize the response to remove NaN and Infinity values
        player_stats = self._sanitize_dict(player_stats)
        
        return Response(player_stats, status=status.HTTP_200_OK)

    def _calculate_player_stats(self, fixture_ids, player_id, matches_df):
        """Calculate comprehensive stats for a specific player"""
        collection_real_matches = settings.MONGO_DB['real_matches']
        
        # Initialize stats
        matches_viewed = 0
        matches_startXI = 0
        total_goals = 0
        total_assists = 0
        yellow_cards = 0
        red_cards = 0
        teams_watched = set()
        wins = 0
        draws = 0
        losses = 0
        
        # Initialize season stats
        seasons_data = {}
        
        # Get all real matches for these fixtures with player data
        # OPTIMIZATION: Filter matches where player appears in the pipeline
        pipeline = [
            {'$match': {
                'fixture.id': {'$in': fixture_ids},
                '$or': [
                    {'lineups.startXI.player.id': player_id},
                    {
                        'events.type': {'$regex': 'subst', '$options': 'i'},
                        'events.assist.id': player_id
                    }
                ]
            }},
            {'$project': {
                'fixture.id': 1,
                'lineups': 1,
                'events': {'$ifNull': ['$events', []]},
                'goals': 1,
                'teams': 1
            }}
        ]
        
        real_matches_dict = {
            rm['fixture']['id']: rm 
            for rm in collection_real_matches.aggregate(pipeline)
        }
        
        # Process each match (matches are already filtered to only include player)
        for _, match_row in matches_df.iterrows():
            fixture_id = match_row['fixture']['id']
            real_match = real_matches_dict.get(fixture_id)
            
            if not real_match:
                continue
            
            # Determine if player started and which team they played for
            player_started = False
            team_id = None
            
            # Check lineups
            if 'lineups' in real_match and real_match['lineups']:
                for lineup in real_match['lineups']:
                    # Check startXI
                    if 'startXI' in lineup:
                        for player_info in lineup['startXI']:
                            p_id = player_info.get('player', {}).get('id')
                            if p_id == player_id:
                                player_started = True
                                team_id = lineup.get('team', {}).get('id')
                                teams_watched.add(team_id)
                                break
                    
            # Check substitution events for team info
            if not player_started and 'events' in real_match:
                for event in real_match['events']:
                    if (event.get('type', '').lower() == 'subst' and 
                        event.get('assist', {}).get('id') == player_id):
                        team_id = event.get('team', {}).get('id')
                        teams_watched.add(team_id)
                        break
            
            # Player was in match (guaranteed by pipeline), count stats
            matches_viewed += 1
            if player_started:
                matches_startXI += 1
            
            # Get season from match data
            season = None
            if 'league' in match_row and isinstance(match_row['league'], dict):
                season = match_row['league'].get('season')
            
            if season is None:
                continue
            
            # Initialize season if needed
            if season not in seasons_data:
                seasons_data[season] = {
                    'teams': {}  # team_id -> { team_name, matches: [], matches_viewed, goals, assists, yellow_cards, red_cards }
                }
            
            # Calculate match result for win/draw/loss
            goals_home = real_match.get('goals', {}).get('home', 0)
            goals_away = real_match.get('goals', {}).get('away', 0)
            
            # Calculate win/draw/loss and initialize team if we have team_id
            if team_id:
                is_home = real_match.get('teams', {}).get('home', {}).get('id') == team_id
                
                if is_home:
                    if goals_home > goals_away:
                        wins += 1
                    elif goals_home < goals_away:
                        losses += 1
                    else:
                        draws += 1
                else:
                    if goals_away > goals_home:
                        wins += 1
                    elif goals_away < goals_home:
                        losses += 1
                    else:
                        draws += 1
                
                # Count goals, assists, and cards
                season_goals = 0
                season_assists = 0
                season_yellow = 0
                season_red = 0
                
                if 'events' in real_match:
                    for event in real_match['events']:
                        event_player_id = event.get('player', {}).get('id')
                        event_type = event.get('type', '').lower()
                        event_detail = event.get('detail', '').lower()
                        
                        # Count goals
                        if event_type == 'goal' and event_player_id == player_id and event_detail != 'own goal' and event_detail != 'missed penalty':
                            total_goals += 1
                            season_goals += 1
                        
                        # Count assists
                        if event_type == 'goal':
                            assist = event.get('assist')
                            if assist and assist.get('id') == player_id:
                                total_assists += 1
                                season_assists += 1
                        
                        # Count cards
                        if event_type == 'card' and event_player_id == player_id:
                            detail = event.get('detail', '').lower()
                            if 'yellow' in detail:
                                yellow_cards += 1
                                season_yellow += 1
                            elif 'red' in detail:
                                red_cards += 1
                                season_red += 1
                
                # Initialize team in season if needed
                if team_id not in seasons_data[season]['teams']:
                    # Get team name
                    team_name = None
                    if is_home:
                        team_name = real_match.get('teams', {}).get('home', {}).get('name')
                    else:
                        team_name = real_match.get('teams', {}).get('away', {}).get('name')
                    
                    seasons_data[season]['teams'][team_id] = {
                        'team_id': team_id,
                        'team_name': team_name or f'Team {team_id}',
                        'matches': [],
                        'matches_viewed': 0,
                        'goals': 0,
                        'assists': 0,
                        'yellow_cards': 0,
                        'red_cards': 0
                    }
                
                # Add stats to team in season
                seasons_data[season]['teams'][team_id]['matches_viewed'] += 1
                seasons_data[season]['teams'][team_id]['goals'] += season_goals
                seasons_data[season]['teams'][team_id]['assists'] += season_assists
                seasons_data[season]['teams'][team_id]['yellow_cards'] += season_yellow
                seasons_data[season]['teams'][team_id]['red_cards'] += season_red
                
                # Add match to team in this season
                match_info = {
                    'fixture': {
                        'id': match_row['fixture']['id'],
                        'timestamp': match_row['fixture'].get('timestamp')
                    },
                    'league': {
                        'id': match_row['league']['id'],
                        'name': match_row['league']['name'],
                        'round': match_row['league'].get('round'),
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
                    'status': match_row.get('status', ''),
                    'player_stats': {
                        'started': player_started,
                        'goals': season_goals,
                        'assists': season_assists,
                        'yellow_cards': season_yellow,
                        'red_cards': season_red
                    }
                }
                seasons_data[season]['teams'][team_id]['matches'].append(match_info)
        
        # Calculate percentages
        total_matches = wins + draws + losses
        win_percentage = round((wins / total_matches) * 100, 1) if total_matches > 0 else 0
        draw_percentage = round((draws / total_matches) * 100, 1) if total_matches > 0 else 0
        loss_percentage = round((losses / total_matches) * 100, 1) if total_matches > 0 else 0
        
        # Format seasons data for response
        seasons_list = []
        for season in sorted(seasons_data.keys(), reverse=True):  # Most recent first
            season_data = seasons_data[season]
            teams_list = list(season_data['teams'].values())
            seasons_list.append({
                'season': season,
                'teams': teams_list
            })
        
        return {
            'player_id': player_id,
            'matches_viewed': matches_viewed,
            'matches_startXI': matches_startXI,
            'total_goals': total_goals,
            'total_assists': total_assists,
            'different_teams_watched': len(teams_watched),
            'win_percentage': win_percentage,
            'draw_percentage': draw_percentage,
            'loss_percentage': loss_percentage,
            'yellow_cards': yellow_cards,
            'red_cards': red_cards,
            'wins': wins,
            'draws': draws,
            'losses': losses,
            'seasons': seasons_list
        }
