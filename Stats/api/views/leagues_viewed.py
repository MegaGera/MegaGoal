from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import pandas as pd
import os
import re
import unicodedata

class LeaguesViewedAPIView(APIView):
  def get(self, request, *args, **kwargs):
    
    # Access the validation data added by the middleware
    validate_data = getattr(request, 'validateData', None)
    if validate_data:
      username = validate_data.get('data').get('username')
    else:
      username = os.getenv('USERNAME_DEV')

    search = (
      request.query_params.get('search')
      or request.query_params.get('q')
      or ''
    )
    search = str(search).strip()

    if username is None:
      return Response({"error": "username parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

    # Use the MongoDB connection from settings
    collection_matches = settings.MONGO_DB['matches']
    df = pd.DataFrame(list(collection_matches.find({
      '$and': [
        { 'user.username': username },
        { 'goals.home': { '$exists': True, '$ne': None } },
        { 'goals.away': { '$exists': True, '$ne': None } }
      ]
    })))
    
    # Check if DataFrame is empty (no matches found)
    if df.empty:
        return Response([], status=status.HTTP_200_OK)
    
    # Check if 'league' column exists
    if 'league' not in df.columns:
        return Response([], status=status.HTTP_200_OK)
    
    # Extract the league ID and name
    leagues = df['league'].apply(lambda x: (x['id'], x['name']))

    # Count occurrences of each league
    league_counts = leagues.value_counts()

    # Convert to a DataFrame for a cleaner presentation
    league_counts_df = league_counts.reset_index()
    league_counts_df.columns = ['league_id_name', 'count']

    # Split the tuple back into separate columns
    league_counts_df[['league_id', 'league_name']] = pd.DataFrame(league_counts_df['league_id_name'].tolist(), index=league_counts_df.index)

    # Drop the combined column
    league_counts_df = league_counts_df.drop(columns=['league_id_name'])

    # Reorder columns to make it more readable
    league_counts_df = league_counts_df[['league_id', 'league_name', 'count']]

    records = league_counts_df.to_dict(orient='records')
    if search:
      records = self._filter_leagues_by_search(records, search)

    return Response(records, status=status.HTTP_200_OK)

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

  def _filter_leagues_by_search(self, leagues, search):
    """Token AND match on folded league_name (exact / prefix / long infix)."""
    tokens = [t for t in self._fold_name(search).split(' ') if t]
    if not tokens:
      return leagues

    matched = []
    for league in leagues:
      words = [
        w
        for w in self._fold_name(league.get('league_name')).split(' ')
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
        matched.append(league)
    return matched
 