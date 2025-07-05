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
- `updater_api.py` - FastAPI server with admin authentication
- `requirements.txt` - Python dependencies

### Environment Variables

Create a `.env` file in the Updater directory with the following variables:

```
# API Configuration
RAPIDAPI_KEY=your_rapidapi_key
RAPIDAPI_HOST=your_rapidapi_host

# Database Configuration
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_USERNAME=your_username
MONGODB_PASSWORD=your_password
MONGODB_DATABASE=your_database

# Authentication (for production)
NODE_ENV=production
VALIDATE_URI_ADMIN=http://megaauth:port/validate-admin

# Development mode (bypasses authentication)
NODE_ENV=development
```

### API Authentication

The Updater service includes admin authentication middleware that validates all requests against the MegaAuth service:

#### Endpoints (all require admin privileges)
- `POST /update_matches/` - Update matches for a specific league and season
- `POST /update_league_current_season/` - Update league current season
- `POST /update_leagues/` - Update all leagues
- `POST /check_available_seasons/` - Check and update available seasons
- `POST /update_teams/` - Update teams for a specific league and season

#### Authentication Flow
1. Client sends request with `access_token` cookie
2. Middleware validates admin token with MegaAuth service using `VALIDATE_URI_ADMIN`
3. If valid, request proceeds; if invalid, returns 401/403 error
4. In development mode (`NODE_ENV=development`), authentication is bypassed

### Docker Deployment

Build and run:

```bash
docker-compose up --build
```

### Running the API Server

Start the FastAPI server:

```bash
uvicorn updater_api:app --host 0.0.0.0 --port 8000 --reload
```

### Cron Schedule

- **Full Update:** Runs daily at midnight (0 0 * * *)
- **Daily Update:** Runs every 28 minutes (*/30 * * * *)
