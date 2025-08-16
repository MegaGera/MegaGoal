from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import pandas as pd
import os

class LeaguesViewedAPIView(APIView):
  def get(self, request, *args, **kwargs):
    
    # Access the validation data added by the middleware
    validate_data = getattr(request, 'validateData', None)
    if validate_data:
      username = validate_data.get('data').get('username')
    else:
      username = os.getenv('USERNAME_DEV')

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

    return Response(league_counts_df.to_dict(orient='records'), status=status.HTTP_200_OK) 