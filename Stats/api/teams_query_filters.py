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
