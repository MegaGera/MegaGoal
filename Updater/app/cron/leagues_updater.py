import datetime
from ..utils import MatchUpdater

def perform_leagues_update():
    """Perform leagues update operation"""
    print("Starting leagues_updater.py")
    print(f"-------------- Starting New Update On --------------")
    print(datetime.datetime.today().strftime('%Y-%m-%d %H:%M:%S'))
    
    updater = MatchUpdater()
    updater.add_leagues()
    print("Leagues update completed successfully")

if __name__ == "__main__":
    perform_leagues_update()

