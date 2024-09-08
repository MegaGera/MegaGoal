from django.urls import path
from .views import TeamsViewedAPIView, LeaguesViewedAPIView

urlpatterns = [
    path('teams-viewed/', TeamsViewedAPIView.as_view(), name='match-stats'),
    path('leagues-viewed/', LeaguesViewedAPIView.as_view(), name='match-stats'),
]