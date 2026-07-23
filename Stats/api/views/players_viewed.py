from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import os

from ..teams_query_filters import parse_teams_query_params, add_teams_mongo_filters

TOP_TEAMS_LIMIT = 3


class PlayersViewedAPIView(APIView):
    """
    Rank players by appearances in the user's watched matches (startXI or sub in).
    Same filter contract as teams-viewed / general-stats.
    Includes top watched clubs for each player and nationality from `players`.
    """

    def get(self, request, *args, **kwargs):
        validate_data = getattr(request, 'validateData', None)
        if validate_data:
            username = validate_data.get('data').get('username')
        else:
            username = os.getenv('USERNAME_DEV')

        team_selection = request.query_params.get('team_selection', None)
        leagues = request.query_params.get('leagues', None)
        season = request.query_params.get('season', None)
        location = request.query_params.get('location', None)

        if username is None:
            return Response(
                {"error": "Username parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if team_selection is None:
            return Response(
                {"error": "Team Selection parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        leagues_array = (
            [int(num) for num in leagues.split(',') if num.strip()]
            if leagues is not None
            else []
        )

        filters = []
        if team_selection == '1':
            filters.append({'league.id': {'$nin': [10, 1, 4, 9, 5]}})
        elif team_selection == '2':
            filters.append({'league.id': {'$in': [10, 1, 4, 9, 5]}})

        if leagues is not None and team_selection != '2' and len(leagues_array) > 0:
            filters.append({'league.id': {'$in': leagues_array}})

        if season is not None and season != '0':
            filters.append({'league.season': int(season)})

        if location is not None and location != '':
            filters.append({'location': location})

        teams_arr, against_arr = parse_teams_query_params(request)
        add_teams_mongo_filters(filters, teams_arr, against_arr)

        filters.append({'user.username': username})
        filters.append({'goals.home': {'$exists': True, '$ne': None}})
        filters.append({'goals.away': {'$exists': True, '$ne': None}})

        query = {'$and': filters} if filters else {}

        collection_matches = settings.MONGO_DB['matches']
        matches = list(
            collection_matches.find(
                query,
                projection={'_id': 0, 'fixture.id': 1},
            )
        )

        if not matches:
            return Response([], status=status.HTTP_200_OK)

        fixture_ids = [
            m.get('fixture', {}).get('id')
            for m in matches
            if m.get('fixture', {}).get('id') is not None
        ]
        if not fixture_ids:
            return Response([], status=status.HTTP_200_OK)

        players = self._rank_players_by_appearances(fixture_ids)
        self._enrich_nationalities(players)
        return Response(players, status=status.HTTP_200_OK)

    def _ensure_player_entry(self, player_matches, player_id, player_name):
        if player_id not in player_matches:
            player_matches[player_id] = {
                'name': player_name,
                'matches': 0,
                'startXI_matches': 0,
                'goals': 0,
                'assists': 0,
                'teams': {},
            }
        return player_matches[player_id]

    def _record_team_appearance(self, entry, team_id, team_name):
        if team_id is None:
            return
        teams = entry['teams']
        if team_id not in teams:
            teams[team_id] = {
                'team_id': team_id,
                'team_name': team_name or f'Team {team_id}',
                'matches': 0,
            }
        elif team_name and teams[team_id]['team_name'].startswith('Team '):
            teams[team_id]['team_name'] = team_name
        teams[team_id]['matches'] += 1

    def _rank_players_by_appearances(self, fixture_ids):
        """Appearances, G/A, and player's watched clubs (not opponents)."""
        collection_real_matches = settings.MONGO_DB['real_matches']
        pipeline = [
            {'$match': {'fixture.id': {'$in': fixture_ids}}},
            {
                '$project': {
                    'fixture.id': 1,
                    'lineups': 1,
                    'events': {
                        '$filter': {
                            'input': {'$ifNull': ['$events', []]},
                            'as': 'event',
                            'cond': {
                                '$or': [
                                    {
                                        '$eq': [
                                            {'$toLower': '$$event.type'},
                                            'subst',
                                        ]
                                    },
                                    {
                                        '$eq': [
                                            {'$toLower': '$$event.type'},
                                            'goal',
                                        ]
                                    },
                                ]
                            },
                        }
                    },
                }
            },
        ]

        real_matches_dict = {
            rm['fixture']['id']: rm for rm in collection_real_matches.aggregate(pipeline)
        }

        player_matches = {}

        for _fixture_id, real_match in real_matches_dict.items():
            # player_id -> (team_id, team_name, started)
            appearance = {}

            for lineup in real_match.get('lineups') or []:
                team = lineup.get('team') or {}
                team_id = team.get('id')
                team_name = team.get('name')
                for player_info in lineup.get('startXI') or []:
                    player = player_info.get('player') or {}
                    player_id = player.get('id')
                    player_name = player.get('name')
                    if player_id and player_name:
                        self._ensure_player_entry(player_matches, player_id, player_name)
                        appearance[player_id] = (team_id, team_name, True)

            for event in real_match.get('events') or []:
                event_type = (event.get('type') or '').lower()
                if event_type != 'subst':
                    continue
                assist = event.get('assist') or {}
                player_id = assist.get('id')
                player_name = assist.get('name')
                if not (player_id and player_name):
                    continue
                self._ensure_player_entry(player_matches, player_id, player_name)
                if player_id not in appearance:
                    team = event.get('team') or {}
                    appearance[player_id] = (team.get('id'), team.get('name'), False)

            for player_id, (team_id, team_name, started) in appearance.items():
                entry = player_matches[player_id]
                entry['matches'] += 1
                if started:
                    entry['startXI_matches'] += 1
                self._record_team_appearance(entry, team_id, team_name)

            for event in real_match.get('events') or []:
                event_type = (event.get('type') or '').lower()
                if event_type != 'goal':
                    continue
                detail = (event.get('detail') or '').lower()
                scorer = event.get('player') or {}
                scorer_id = scorer.get('id')
                scorer_name = scorer.get('name')
                if (
                    scorer_id
                    and scorer_name
                    and scorer_id in appearance
                    and detail != 'own goal'
                    and detail != 'missed penalty'
                ):
                    entry = self._ensure_player_entry(
                        player_matches, scorer_id, scorer_name
                    )
                    entry['goals'] += 1

                assist = event.get('assist') or {}
                assist_id = assist.get('id')
                assist_name = assist.get('name')
                if assist_id and assist_name and assist_id in appearance:
                    entry = self._ensure_player_entry(
                        player_matches, assist_id, assist_name
                    )
                    entry['assists'] += 1

        ranked = []
        for player_id, stats in player_matches.items():
            if stats['matches'] <= 0:
                continue
            teams = sorted(
                stats['teams'].values(),
                key=lambda t: (-t['matches'], t['team_name']),
            )[:TOP_TEAMS_LIMIT]
            ranked.append(
                {
                    'player_id': player_id,
                    'player_name': stats['name'],
                    'matches': stats['matches'],
                    'startXI_matches': stats['startXI_matches'],
                    'goals': stats['goals'],
                    'assists': stats['assists'],
                    'teams': teams,
                    'nationality': None,
                    'nationality_flag': None,
                }
            )

        ranked.sort(
            key=lambda x: (-x['matches'], -x['startXI_matches'], x['player_name'])
        )
        return ranked

    def _enrich_nationalities(self, players):
        if not players:
            return

        player_ids = [p['player_id'] for p in players]
        collection_players = settings.MONGO_DB['players']
        docs = list(
            collection_players.find(
                {'player.id': {'$in': player_ids}},
                projection={'_id': 0, 'player.id': 1, 'player.nationality': 1},
            )
        )

        nationality_by_id = {}
        for doc in docs:
            player = doc.get('player') or {}
            pid = player.get('id')
            if pid is None:
                continue
            nationality = player.get('nationality')
            if isinstance(nationality, str):
                nationality = nationality.strip() or None
            else:
                nationality = None
            nationality_by_id[pid] = nationality

        countries_map = self._load_countries_map()

        for row in players:
            nationality = nationality_by_id.get(row['player_id'])
            row['nationality'] = nationality
            flag = None
            if nationality:
                country = countries_map.get(nationality.lower())
                if country:
                    flag = country.get('flag')
            row['nationality_flag'] = flag

    def _load_countries_map(self):
        """name.lower() -> { name, code, flag } from countries collection."""
        collection_countries = settings.MONGO_DB['countries']
        docs = list(
            collection_countries.find(
                {},
                projection={'_id': 0, 'name': 1, 'code': 1, 'flag': 1},
            )
        )
        result = {}
        for doc in docs:
            name = doc.get('name')
            if not isinstance(name, str) or not name.strip():
                continue
            key = name.strip().lower()
            flag = doc.get('flag')
            if isinstance(flag, str):
                flag = flag.strip() or None
            else:
                flag = None
            code = doc.get('code')
            if isinstance(code, str):
                code = code.strip() or None
            else:
                code = None
            result[key] = {'name': name.strip(), 'code': code, 'flag': flag}
        return result
