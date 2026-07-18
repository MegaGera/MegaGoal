from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import os

from api.player_participation import (
    find_player_team,
    count_player_match_events,
    player_participation_match_clause,
    empty_team_bucket,
)


class PlayerCareerStatsAPIView(APIView):
    """
    Career (all appearances) aggregates per season/team from real_matches,
    scoped by the player's stored career teams. Also reports matches_viewed
    for the authenticated user.
    Does not return match lists (use player-team-season-matches for that).
    """

    def get(self, request, *args, **kwargs):
        validate_data = getattr(request, 'validateData', None)
        if validate_data:
            username = validate_data.get('data', {}).get('username')
        else:
            username = os.getenv('USERNAME_DEV')

        if username is None:
            return Response({"error": "Username parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        player_id_param = request.query_params.get('player_id')
        if player_id_param is None:
            return Response({"error": "player_id parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            player_id = int(player_id_param)
        except (TypeError, ValueError):
            return Response({"error": "player_id must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

        players_collection = settings.MONGO_DB['players']
        player_doc = players_collection.find_one({'player.id': player_id}, {'teams': 1, 'player.id': 1})
        if not player_doc:
            return Response({"error": "Player not found"}, status=status.HTTP_404_NOT_FOUND)

        career_pairs = self._career_team_seasons(player_doc.get('teams') or [])
        if not career_pairs:
            return Response({'player_id': player_id, 'seasons': []}, status=status.HTTP_200_OK)

        watched_fixture_ids = self._watched_fixture_ids(username)

        # season -> set of team_ids; team_id -> name from career
        seasons_teams = {}
        team_names = {}
        for team_id, season, team_name in career_pairs:
            seasons_teams.setdefault(season, set()).add(team_id)
            if team_name:
                team_names[team_id] = team_name

        # season -> team_id -> bucket
        seasons_data = {}
        for season, team_ids in seasons_teams.items():
            seasons_data[season] = {
                tid: empty_team_bucket(tid, team_names.get(tid))
                for tid in team_ids
            }

        real_matches = settings.MONGO_DB['real_matches']
        for season, team_ids in seasons_teams.items():
            team_id_list = list(team_ids)
            pipeline = [
                {
                    '$match': {
                        'league.season': season,
                        '$and': [
                            {
                                '$or': [
                                    {'teams.home.id': {'$in': team_id_list}},
                                    {'teams.away.id': {'$in': team_id_list}},
                                ]
                            },
                            player_participation_match_clause(player_id),
                        ],
                    }
                },
                {
                    '$project': {
                        'fixture.id': 1,
                        'fixture.timestamp': 1,
                        'league': 1,
                        'teams': 1,
                        'goals': 1,
                        'lineups': 1,
                        'events': {'$ifNull': ['$events', []]},
                    }
                },
            ]

            for real_match in real_matches.aggregate(pipeline):
                team_id, _started, participated = find_player_team(real_match, player_id)
                if not participated or team_id not in seasons_data[season]:
                    continue

                fixture_id = (real_match.get('fixture') or {}).get('id')
                goals, assists, yellow, red = count_player_match_events(real_match, player_id)
                bucket = seasons_data[season][team_id]
                bucket['matches_played'] += 1
                bucket['goals'] += goals
                bucket['assists'] += assists
                bucket['yellow_cards'] += yellow
                bucket['red_cards'] += red
                if fixture_id is not None and fixture_id in watched_fixture_ids:
                    bucket['matches_viewed'] += 1

                # Prefer live name from match if career name missing
                if not team_names.get(team_id):
                    teams = real_match.get('teams') or {}
                    home = teams.get('home') or {}
                    away = teams.get('away') or {}
                    if home.get('id') == team_id:
                        bucket['team_name'] = home.get('name') or bucket['team_name']
                    elif away.get('id') == team_id:
                        bucket['team_name'] = away.get('name') or bucket['team_name']

        seasons_list = []
        for season in sorted(seasons_data.keys(), reverse=True):
            teams_list = list(seasons_data[season].values())
            teams_list.sort(key=lambda t: (-t['matches_played'], t['team_name'] or ''))
            seasons_list.append({'season': season, 'teams': teams_list})

        return Response({'player_id': player_id, 'seasons': seasons_list}, status=status.HTTP_200_OK)

    def _career_team_seasons(self, teams):
        """Yield (team_id, season, team_name) from player.teams documents."""
        pairs = []
        seen = set()
        for entry in teams:
            team = entry.get('team') or {}
            team_id = team.get('id')
            if team_id is None:
                continue
            team_name = team.get('name')
            for season in entry.get('seasons') or []:
                try:
                    year = int(season)
                except (TypeError, ValueError):
                    continue
                key = (team_id, year)
                if key in seen:
                    continue
                seen.add(key)
                pairs.append((team_id, year, team_name))
        return pairs

    def _watched_fixture_ids(self, username):
        matches_collection = settings.MONGO_DB['matches']
        cursor = matches_collection.find(
            {'user.username': username},
            {'fixture.id': 1},
        )
        ids = set()
        for row in cursor:
            fid = (row.get('fixture') or {}).get('id')
            if fid is not None:
                ids.add(fid)
        return ids
