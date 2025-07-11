from django.urls import path
from .views import TeamsViewedAPIView, LeaguesViewedAPIView, UserGeneralStatsAPIView

urlpatterns = [
    path('teams-viewed/', TeamsViewedAPIView.as_view(), name='match-stats'),
    path('leagues-viewed/', LeaguesViewedAPIView.as_view(), name='match-stats'),
    path('user-general-stats/', UserGeneralStatsAPIView.as_view(), name='user-general-stats'),
]