from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import pandas as pd
from pandas import json_normalize
import os

class TeamsViewedAPIView(APIView):
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

    if username is None:
      return Response({"error": "Username parameter is required"}, status=status.HTTP_400_BAD_REQUEST)
    if team_selection is None:
      return Response({"error": "Team Selection parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

    leaguesArray = [int(num) for num in leagues.split(',') if num.strip()]

    filters = []; 
    if team_selection == '1':
      filters.append({
        'league.id': {'$nin': [10, 1, 4, 9]}
      })
    elif team_selection == '2':
      filters.append({
        'league.id': {'$in': [10, 1, 4, 9]}
      })

    if leagues != None and team_selection != '2' and len(leaguesArray) > 0:
      filters.append({
        'league.id': {'$in': leaguesArray}
      })
    
    if season != None and season != '0':
      filters.append({ 'league.season': int(season) })

    filters.append({ 'user.username': username });

    # Add filter to the query
    if len(filters) > 0:
      query = { '$and': filters }
    else:
      query = {}

    # Use the MongoDB connection from settings
    collection_matches = settings.MONGO_DB['matches']
    df = pd.DataFrame(list(collection_matches.find(query)))

    if len(df) > 0:
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
      team_stats_df = team_stats_df.sort_values(by='count', ascending=False)

      return Response(team_stats_df.to_dict(orient='records'), status=status.HTTP_200_OK)
    return Response([], status=status.HTTP_200_OK)

class LeaguesViewedAPIView(APIView):
  def get(self, request, *args, **kwargs):
    username = request.query_params.get('username', None)

    if username is None:
      return Response({"error": "username parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

    # Use the MongoDB connection from settings
    collection_matches = settings.MONGO_DB['matches']
    df = pd.DataFrame(list(collection_matches.find( { "user.username": username } )))
    
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
