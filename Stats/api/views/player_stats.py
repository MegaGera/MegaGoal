from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import pandas as pd
import os

class PlayerStatsAPIView(APIView):
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
        
        # Get all real matches for these fixtures with player data
        pipeline = [
            {'$match': {'fixture.id': {'$in': fixture_ids}}},
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
        
        # Process each match
        for _, match_row in matches_df.iterrows():
            fixture_id = match_row['fixture']['id']
            real_match = real_matches_dict.get(fixture_id)
            
            if not real_match:
                continue
            
            # Check if player appeared in this match (startXI or substitution)
            player_in_match = False
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
                                player_in_match = True
                                player_started = True
                                team_id = lineup.get('team', {}).get('id')
                                teams_watched.add(team_id)
                                break
                    
            if 'events' in real_match:
                for event in real_match['events']:
                    if (event.get('type', '').lower() == 'subst' and 
                        event.get('assist', {}).get('id') == player_id):
                        player_in_match = True
                        team_id = event.get('team', {}).get('id')
                        teams_watched.add(team_id)
            
            # If player was in match, count stats
            if player_in_match:
                matches_viewed += 1
                if player_started:
                    matches_startXI += 1
                
                # Calculate match result for win/draw/loss
                goals_home = real_match.get('goals', {}).get('home', 0)
                goals_away = real_match.get('goals', {}).get('away', 0)
                
                # Calculate win/draw/loss
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
                if 'events' in real_match:
                    for event in real_match['events']:
                        event_player_id = event.get('player', {}).get('id')
                        event_type = event.get('type', '').lower()
                        
                        # Count goals
                        if event_type == 'goal' and event_player_id == player_id:
                            total_goals += 1
                        
                        # Count assists
                        if event_type == 'goal':
                            assist = event.get('assist')
                            if assist and assist.get('id') == player_id:
                                total_assists += 1
                        
                        # Count cards
                        if event_type == 'card' and event_player_id == player_id:
                            detail = event.get('detail', '').lower()
                            if 'yellow' in detail:
                                yellow_cards += 1
                            elif 'red' in detail:
                                red_cards += 1
        
        # Calculate percentages
        total_matches = wins + draws + losses
        win_percentage = round((wins / total_matches) * 100, 1) if total_matches > 0 else 0
        draw_percentage = round((draws / total_matches) * 100, 1) if total_matches > 0 else 0
        loss_percentage = round((losses / total_matches) * 100, 1) if total_matches > 0 else 0
        
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
            'losses': losses
        }
