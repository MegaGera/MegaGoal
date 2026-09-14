from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import math
import os
import re
import unicodedata
import pandas as pd

from ..teams_query_filters import parse_teams_query_params, add_teams_mongo_filters

DEFAULT_PAGE = 1
DEFAULT_LIMIT = 10
MAX_LIMIT = 100


class TeamsViewedAPIView(APIView):
  """
  Rank teams by appearances in the user's watched matches.
  Same filter contract as players-viewed / general-stats.

  Without `page`: returns the full ranked array (home/filter pickers).
  With `page` (and optional `limit`): returns a paginated envelope and
  enriches the current page with country + flag from `teams` / `countries`.
  Optional `search` / `q` filters by team name before pagination.
  """

  def get(self, request, *args, **kwargs):

    # Access the validation data added by the middleware
    validate_data = getattr(request, 'validateData', None)
    if validate_data:
      username = validate_data.get('data').get('username')
    else:
      username = os.getenv('USERNAME_DEV')

    team_selection = request.query_params.get('team_selection', None)

    leagues = request.query_params.get('leagues', None)
    season = request.query_params.get('season', None)
    location = request.query_params.get('location', None)
    search = (
      request.query_params.get('search')
      or request.query_params.get('q')
      or ''
    ).strip()
    paginate = 'page' in request.query_params
    page, limit = self._parse_pagination(request) if paginate else (None, None)

    if username is None:
      return Response({"error": "Username parameter is required"}, status=status.HTTP_400_BAD_REQUEST)
    if team_selection is None:
      return Response({"error": "Team Selection parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

    leaguesArray = [int(num) for num in leagues.split(',') if num.strip()] if leagues is not None else []

    filters = []; 
    if team_selection == '1':
      filters.append({
        'league.id': {'$nin': [10, 1, 4, 9, 5]}
      })
    elif team_selection == '2':
      filters.append({
        'league.id': {'$in': [10, 1, 4, 9, 5]}
      })

    if leagues != None and team_selection != '2' and len(leaguesArray) > 0:
      filters.append({
        'league.id': {'$in': leaguesArray}
      })
    
    if season != None and season != '0':
      filters.append({ 'league.season': int(season) })

    if location != None and location != '':
      filters.append({ 'location': location })

    teams_arr, against_arr = parse_teams_query_params(request)
    add_teams_mongo_filters(filters, teams_arr, against_arr)

    filters.append({ 'user.username': username });

    # Exclude matches with null or missing goals
    filters.append({ 'goals.home': { '$exists': True, '$ne': None } })
    filters.append({ 'goals.away': { '$exists': True, '$ne': None } })

    # Add filter to the query
    if len(filters) > 0:
      query = { '$and': filters }
    else:
      query = {}

    # Use the MongoDB connection from settings
    collection_matches = settings.MONGO_DB['matches']
    df = pd.DataFrame(list(collection_matches.find(query)))

    if len(df) == 0:
      if paginate:
        return Response(self._empty_page(page, limit), status=status.HTTP_200_OK)
      return Response([], status=status.HTTP_200_OK)

    # Extract the home and away team IDs and goals
    home_teams = df.apply(lambda x: (x['teams']['home']['id'], x['teams']['home']['name'], x['goals']['home']), axis=1)
    away_teams = df.apply(lambda x: (x['teams']['away']['id'], x['teams']['away']['name'], x['goals']['away']), axis=1)

    # Combine both into a single DataFrame
    all_teams = pd.concat([home_teams, away_teams], ignore_index=True)

    # Convert to a DataFrame for a cleaner presentation
    all_teams_df = pd.DataFrame(all_teams.tolist(), columns=['team_id', 'team_name', 'goals'])

    # Count occurrences of each team and sum the goals
    team_stats_df = all_teams_df.groupby(['team_id', 'team_name']).agg({'team_id': 'count', 'goals': 'sum'}).rename(columns={'team_id': 'count'}).reset_index()

    # Rename columns for clarity
    team_stats_df.columns = ['team_id', 'team_name', 'count', 'total_goals']

    # Reorder columns to make it more readable
    team_stats_df = team_stats_df.sort_values(by=['count', 'total_goals', 'team_name'], ascending=[False, False, True])

    records = team_stats_df.to_dict(orient='records')
    if search:
      records = self._filter_teams_by_search(records, search)

    if not paginate:
      return Response(records, status=status.HTTP_200_OK)

    return Response(
      self._paginate_teams(records, page, limit),
      status=status.HTTP_200_OK,
    )

  def _parse_pagination(self, request):
    try:
      page = int(request.query_params.get('page', DEFAULT_PAGE))
    except (TypeError, ValueError):
      page = DEFAULT_PAGE
    try:
      limit = int(request.query_params.get('limit', DEFAULT_LIMIT))
    except (TypeError, ValueError):
      limit = DEFAULT_LIMIT
    page = max(1, page)
    limit = min(MAX_LIMIT, max(1, limit))
    return page, limit

  def _empty_page(self, page, limit):
    return {
      'results': [],
      'page': page,
      'limit': limit,
      'total': 0,
      'total_pages': 0,
    }

  def _paginate_teams(self, teams, page, limit):
    total = len(teams)
    total_pages = math.ceil(total / limit) if total else 0
    if total_pages and page > total_pages:
      page = total_pages
    start = (page - 1) * limit
    page_teams = teams[start : start + limit]
    self._enrich_countries(page_teams)
    return {
      'results': page_teams,
      'page': page,
      'limit': limit,
      'total': total,
      'total_pages': total_pages,
    }


  @staticmethod
  def _fold_name(value):
    """Lowercase, strip diacritics/punctuation, collapse whitespace."""
    text = unicodedata.normalize('NFD', str(value or ''))
    text = ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn')
    text = text.lower()
    text = (
      text.replace('ß', 'ss')
      .replace('æ', 'ae')
      .replace('œ', 'oe')
      .replace('ø', 'o')
      .replace('ł', 'l')
      .replace('đ', 'd')
    )
    text = re.sub(r"[''`´.]", '', text)
    text = re.sub(r'[^a-z0-9]+', ' ', text)
    return text.strip()

  def _filter_teams_by_search(self, teams, search):
    """Token AND match on folded team_name (exact / prefix / long infix)."""
    tokens = [t for t in self._fold_name(search).split(' ') if t]
    if not tokens:
      return teams

    matched = []
    for team in teams:
      words = [
        w
        for w in self._fold_name(team.get('team_name')).split(' ')
        if w
      ]
      if not words:
        continue
      if all(
        any(
          word == token
          or word.startswith(token)
          or (len(token) >= 5 and token in word)
          for word in words
        )
        for token in tokens
      ):
        matched.append(team)
    return matched

  def _enrich_countries(self, teams):
    if not teams:
      return

    team_ids = [t['team_id'] for t in teams]
    collection_teams = settings.MONGO_DB['teams']
    docs = list(
      collection_teams.find(
        {'team.id': {'$in': team_ids}},
        projection={'_id': 0, 'team.id': 1, 'team.country': 1},
      )
    )

    country_by_id = {}
    for doc in docs:
      team = doc.get('team') or {}
      tid = team.get('id')
      if tid is None:
        continue
      country = team.get('country')
      if isinstance(country, str):
        country = country.strip() or None
      else:
        country = None
      country_by_id[tid] = country

    countries_map = self._load_countries_map()

    for row in teams:
      country = country_by_id.get(row['team_id'])
      row['country'] = country
      flag = None
      if country:
        country_doc = countries_map.get(country.lower())
        if country_doc:
          flag = country_doc.get('flag')
      row['country_flag'] = flag

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
