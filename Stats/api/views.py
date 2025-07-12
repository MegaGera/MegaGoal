# Import views from the views folder
from .views import TeamsViewedAPIView, LeaguesViewedAPIView, UserGeneralStatsAPIView, FavouriteTeamStatsAPIView

# Re-export for backward compatibility
__all__ = [
    'TeamsViewedAPIView',
    'LeaguesViewedAPIView',
    'UserGeneralStatsAPIView',
    'FavouriteTeamStatsAPIView'
]
