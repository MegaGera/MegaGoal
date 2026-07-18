from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import os

from api.player_participation import (
    find_player_team,
    player_participation_match_clause,
    build_match_row,
)


class PlayerTeamSeasonMatchesAPIView(APIView):
    """
    Lazy match list: all real_matches where the player appeared for a given
    team + season, with watched=true when the user has that fixture in matches.
    """

    def get(self, request, *args, **kwargs):
        validate_data = getattr(request, 'validateData', None)
        if validate_data:
            username = validate_data.get('data', {}).get('username')
        else:
            username = os.getenv('USERNAME_DEV')

        if username is None:
            return Response({"error": "Username parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            player_id = int(request.query_params.get('player_id'))
            team_id = int(request.query_params.get('team_id'))
            season = int(request.query_params.get('season'))
        except (TypeError, ValueError):
            return Response(
                {"error": "player_id, team_id, and season are required integers"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        watched_map = self._watched_fixture_map(username)

        pipeline = [
            {
                '$match': {
                    'league.season': season,
                    '$and': [
                        {
                            '$or': [
                                {'teams.home.id': team_id},
                                {'teams.away.id': team_id},
                            ]
                        },
                        player_participation_match_clause(player_id),
                    ],
                }
            },
            {
                '$project': {
                    'fixture': 1,
                    'league': 1,
                    'teams': 1,
                    'goals': 1,
                    'lineups': 1,
                    'events': {'$ifNull': ['$events', []]},
                    'status': 1,
                }
            },
            {'$sort': {'fixture.timestamp': -1}},
        ]

        matches = []
        real_matches = settings.MONGO_DB['real_matches']
        for real_match in real_matches.aggregate(pipeline):
            played_team_id, started, participated = find_player_team(real_match, player_id)
            if not participated or played_team_id != team_id:
                continue

            fixture_id = (real_match.get('fixture') or {}).get('id')
            watched_info = watched_map.get(fixture_id) if fixture_id is not None else None
            watched = watched_info is not None
            location = (watched_info or {}).get('location', '')

            matches.append(
                build_match_row(real_match, player_id, started, watched, location=location)
            )

        return Response(
            {
                'player_id': player_id,
                'team_id': team_id,
                'season': season,
                'matches': matches,
                'count': len(matches),
            },
            status=status.HTTP_200_OK,
        )

    def _watched_fixture_map(self, username):
        """fixture_id -> { location } for the user."""
        matches_collection = settings.MONGO_DB['matches']
        cursor = matches_collection.find(
            {'user.username': username},
            {'fixture.id': 1, 'location': 1},
        )
        out = {}
        for row in cursor:
            fid = (row.get('fixture') or {}).get('id')
            if fid is not None:
                out[fid] = {'location': row.get('location') or ''}
        return out
