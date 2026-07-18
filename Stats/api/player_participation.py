"""
Shared helpers for player participation in real_matches (startXI or substitution).
Aligned with Stats player_stats and MCP player_played_* logic.
"""


def find_player_team(real_match, player_id):
    """
    Returns (team_id, started, participated).
    started=True if in startXI; participated=True if started or came on as sub (assist on subst).
    """
    lineups = real_match.get('lineups') or []
    for lineup in lineups:
        team = lineup.get('team') or {}
        team_id = team.get('id')
        for player_info in lineup.get('startXI') or []:
            pid = (player_info.get('player') or {}).get('id')
            if pid == player_id:
                return team_id, True, True

    for event in real_match.get('events') or []:
        event_type = (event.get('type') or '').lower()
        if event_type == 'subst':
            assist = event.get('assist') or {}
            if assist.get('id') == player_id:
                team = event.get('team') or {}
                return team.get('id'), False, True

    return None, False, False


def count_player_match_events(real_match, player_id):
    """Goals (excl. own goal / missed penalty), assists, yellow cards, red cards."""
    goals = 0
    assists = 0
    yellow_cards = 0
    red_cards = 0

    for event in real_match.get('events') or []:
        event_type = (event.get('type') or '').lower()
        detail = (event.get('detail') or '').lower()
        event_player_id = (event.get('player') or {}).get('id')

        if (
            event_type == 'goal'
            and event_player_id == player_id
            and detail != 'own goal'
            and detail != 'missed penalty'
        ):
            goals += 1

        if event_type == 'goal':
            assist = event.get('assist')
            if assist and assist.get('id') == player_id:
                assists += 1

        if event_type == 'card' and event_player_id == player_id:
            if 'yellow' in detail:
                yellow_cards += 1
            elif 'red' in detail:
                red_cards += 1

    return goals, assists, yellow_cards, red_cards


def player_participation_match_clause(player_id):
    """Mongo $or clause: player in startXI or substitution (assist id)."""
    return {
        '$or': [
            {'lineups.startXI.player.id': player_id},
            {
                'events.type': {'$regex': 'subst', '$options': 'i'},
                'events.assist.id': player_id,
            },
        ]
    }


def build_match_row(real_match, player_id, started, watched, location=''):
    """Shape compatible with WebApp Match + player_stats (+ watched)."""
    goals, assists, yellow_cards, red_cards = count_player_match_events(real_match, player_id)
    fixture = real_match.get('fixture') or {}
    league = real_match.get('league') or {}
    teams = real_match.get('teams') or {}
    home = teams.get('home') or {}
    away = teams.get('away') or {}
    match_goals = real_match.get('goals') or {}

    return {
        '_id': '',
        'fixture': {
            'id': fixture.get('id'),
            'timestamp': fixture.get('timestamp'),
        },
        'league': {
            'id': league.get('id'),
            'name': league.get('name'),
            'round': league.get('round'),
            'season': league.get('season'),
        },
        'teams': {
            'home': {'id': home.get('id'), 'name': home.get('name')},
            'away': {'id': away.get('id'), 'name': away.get('name')},
        },
        'goals': {
            'home': match_goals.get('home'),
            'away': match_goals.get('away'),
        },
        'location': location or '',
        'status': (fixture.get('status') or {}).get('short', '')
        if isinstance(fixture.get('status'), dict)
        else (real_match.get('status') or ''),
        'watched': bool(watched),
        'player_stats': {
            'started': bool(started),
            'goals': goals,
            'assists': assists,
            'yellow_cards': yellow_cards,
            'red_cards': red_cards,
        },
    }


def empty_team_bucket(team_id, team_name):
    return {
        'team_id': team_id,
        'team_name': team_name or f'Team {team_id}',
        'matches_played': 0,
        'matches_viewed': 0,
        'goals': 0,
        'assists': 0,
        'yellow_cards': 0,
        'red_cards': 0,
    }
