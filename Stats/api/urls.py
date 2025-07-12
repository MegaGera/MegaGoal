from django.urls import path
from .views import TeamsViewedAPIView, LeaguesViewedAPIView, UserGeneralStatsAPIView, FavouriteTeamStatsAPIView

urlpatterns = [
    path('teams-viewed/', TeamsViewedAPIView.as_view(), name='match-stats'),
    path('leagues-viewed/', LeaguesViewedAPIView.as_view(), name='match-stats'),
    path('user-general-stats/', UserGeneralStatsAPIView.as_view(), name='user-general-stats'),
    path('favourite-team-stats/', FavouriteTeamStatsAPIView.as_view(), name='favourite-team-stats'),
]