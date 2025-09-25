from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import random
from datetime import datetime, timedelta

class LandingPageTeamStatsAPIView(APIView):
    def get(self, request, *args, **kwargs):
        """
        Returns demo favourite team stats for the landing page
        Specifically for team ID 541 with random match data
        """
        team_id = 541
        
        # Generate random stats data
        demo_stats = self._generate_demo_stats(team_id)
        
        return Response(demo_stats, status=status.HTTP_200_OK)
    
    def _generate_demo_stats(self, team_id):
        """Generate random demo stats for team ID 541"""
        
        # Random basic stats
        views_count = random.randint(15, 45)
        goals_scored = random.randint(35, 85)
        goals_conceded = random.randint(25, 75)
        wins = random.randint(8, 25)
        draws = random.randint(3, 12)
        losses = random.randint(2, 15)
        
        # Calculate win rate
        total_matches = wins + draws + losses
        win_rate = round((wins / total_matches) * 100) if total_matches > 0 else 0
        
        # Generate crazy match (high scoring)
        crazy_match = self._generate_crazy_match(team_id)
        
        # Generate biggest rival
        biggest_rival = self._generate_biggest_rival()
        
        return {
            'team_id': team_id,
            'team_name': 'Real Madrid',  # Team 541 is Real Madrid
            'views_count': views_count,
            'goals_scored': goals_scored,
            'goals_conceded': goals_conceded,
            'matches_watched': total_matches,
            'win_rate': win_rate,
            'crazy_match': crazy_match,
            'biggest_rival': biggest_rival,
            'most_viewed_location': None,
            'home_stadium_times': {
                'location_name': "Santiago Bernabéu",
                'views_count': 15
            },
            'total_away_stadium_visits': 7,
            'away_stadium_support': None
        }
    
    def _generate_crazy_match(self, team_id):
        """Generate a high-scoring crazy match"""
        # Common high-scoring opponents
        opponents = [
            {'id': 529, 'name': 'Barcelona'},
            {'id': 530, 'name': 'Atletico Madrid'},
            {'id': 531, 'name': 'Valencia'},
            {'id': 532, 'name': 'Sevilla'},
            {'id': 533, 'name': 'Villarreal'}
        ]
        
        opponent = random.choice(opponents)
        is_home = random.choice([True, False])
        
        # High scoring match
        home_goals = random.randint(4, 7)
        away_goals = random.randint(3, 6)
        
        # Adjust based on whether team is home or away
        if is_home:
            team_goals = home_goals
            opponent_goals = away_goals
        else:
            team_goals = away_goals
            opponent_goals = home_goals
        
        # Generate a recent timestamp
        match_date = datetime.now() - timedelta(days=random.randint(1, 90))
        
        return {
            'teams': {
                'home': {
                    'id': team_id if is_home else opponent['id'],
                    'name': 'Real Madrid' if is_home else opponent['name']
                },
                'away': {
                    'id': opponent['id'] if is_home else team_id,
                    'name': opponent['name'] if is_home else 'Real Madrid'
                }
            },
            'goals': {
                'home': home_goals,
                'away': away_goals
            }
        }
    
    def _generate_biggest_rival(self):
        """Generate biggest rival stats"""
        rivals = [
            {'id': 529, 'name': 'Barcelona', 'matches': random.randint(3, 8)},
            {'id': 530, 'name': 'Atletico Madrid', 'matches': random.randint(2, 6)},
            {'id': 531, 'name': 'Valencia', 'matches': random.randint(2, 5)},
            {'id': 532, 'name': 'Sevilla', 'matches': random.randint(1, 4)}
        ]
        
        # Select the rival with most matches
        biggest_rival = max(rivals, key=lambda x: x['matches'])
        
        return {
            'team_id': biggest_rival['id'],
            'team_name': biggest_rival['name'],
            'matches_played': biggest_rival['matches']
        }
