from django.urls import path
from .views import (
    TeamsViewedAPIView,
    LeaguesViewedAPIView,
    UserGeneralStatsAPIView,
    FavouriteTeamStatsAPIView,
    GeneralStatsAPIView,
    LandingPageTeamStatsAPIView,
    PlayerStatsAPIView,
    TeamGeneralStatsAPIView,
)

urlpatterns = [
    path('teams-viewed/', TeamsViewedAPIView.as_view(), name='match-stats'),
    path('leagues-viewed/', LeaguesViewedAPIView.as_view(), name='leagues-viewed'),
    path('user-general-stats/', UserGeneralStatsAPIView.as_view(), name='user-general-stats'),
    path('favourite-team-stats/', FavouriteTeamStatsAPIView.as_view(), name='favourite-team-stats'),
    path('general-stats/', GeneralStatsAPIView.as_view(), name='general-stats'),
    path('landing-page-team-stats/', LandingPageTeamStatsAPIView.as_view(), name='landing-page-team-stats'),
    path('player-stats/', PlayerStatsAPIView.as_view(), name='player-stats'),
    path('team-general-stats/', TeamGeneralStatsAPIView.as_view(), name='team-general-stats'),
]