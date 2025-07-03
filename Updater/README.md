# MegaGoal Updater Service

The MegaGoal Updater Service is responsible for keeping the football database synchronized with live match data from external APIs. It performs two main types of updates:

### Daily Updates (`matches_updater_daily.py`)

- **Purpose**: Updates ongoing matches and recent results
- **Frequency**: Runs every 28 minutes during active hours
- **What it does**:
  - Fetches matches from leagues that have active games today
  - Updates live scores, match status, and goals for ongoing matches
  - Only processes matches that haven't finished yet
  - Updates league settings with the last daily update timestamp

### Full Updates (`matches_updater_full.py`)

- **Purpose**: Complete database refresh and future match scheduling
- **Frequency**: Runs once daily at midnight
- **What it does**:
  - Fetches all matches for active leagues and seasons
  - Adds new matches to the database
  - Updates existing match data
  - Calculates and sets the next scheduled match for each league
  - Updates league settings with last update timestamp

### Key Features

- **Smart Scheduling**: Only updates leagues that need updating based on frequency settings
- **Duplicate Prevention**: Checks if matches already exist before adding new ones
- **Status Tracking**: Tracks match status (live, finished, postponed, etc.)
- **Database Synchronization**: Keeps real_matches and matches collections in sync

### Files Structure

- `config.py` - Configuration management with environment variables
- `utils.py` - Shared utilities and database operations
- `matches_updater_daily.py` - Daily updater script
- `matches_updater_full.py` - Full updater script
- `requirements.txt` - Python dependencies

### Environment Variables

Create a `.env` file in the Updater directory based on `.env.example`:

### Docker Deployment

Build and run:

```bash
docker-compose up --build
```

### Cron Schedule

- **Full Update:** Runs daily at midnight (0 0 * * *)
- **Daily Update:** Runs every 28 minutes (*/30 * * * *)
