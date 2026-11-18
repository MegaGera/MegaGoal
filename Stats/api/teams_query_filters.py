"""
Optional MongoDB filters for ?teams= and ?teams_against= query params.
teams: match involves at least one listed club (home or away).
teams_against: match is between a club in teams and a club in teams_against (one home, one away).
"""


def parse_teams_query_params(request):
    teams_raw = request.query_params.get('teams', '') or ''
    against_raw = request.query_params.get('teams_against', '') or ''
    teams_arr = [int(x) for x in teams_raw.split(',') if str(x).strip()]
    against_arr = [int(x) for x in against_raw.split(',') if str(x).strip()]
    return teams_arr, against_arr


def add_official_stadium_filter(filters, request, username):
    """
    When ?stadium=1, keep watched matches whose location is one of the user's
    official stadium locations. Independent of the clubs/nations chip.
    """
    raw = (request.query_params.get('stadium') or '').strip().lower()
    if raw not in ('1', 'true', 'yes'):
        return
    from django.conf import settings
    ids = list(settings.MONGO_DB['locations'].distinct(
        'id',
        {'user.username': username, 'stadium': True},
    ))
    filters.append({'location': {'$in': ids}})


def add_teams_mongo_filters(filters, teams_arr, against_arr):
    """
    Mutates filters list in place.
    """
    if teams_arr:
        filters.append({
            '$or': [
                {'teams.home.id': {'$in': teams_arr}},
                {'teams.away.id': {'$in': teams_arr}}
            ]
        })
    if against_arr and teams_arr:
        filters.append({
            '$or': [
                {
                    '$and': [
                        {'teams.home.id': {'$in': teams_arr}},
                        {'teams.away.id': {'$in': against_arr}}
                    ]
                },
                {
                    '$and': [
                        {'teams.away.id': {'$in': teams_arr}},
                        {'teams.home.id': {'$in': against_arr}}
                    ]
                }
            ]
        })
