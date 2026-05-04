import { getDB } from '../config/db.js';
import { logUserAction } from './logController.js';
import {
  buildNewUserDocument,
  buildUserMeResponse,
  parseMarkHomeNotificationPayload,
  parseSetFavouriteLeaguePayload,
  parseSetFavouriteTeamPayload,
  parseUserDocument
} from '../entities/userEntity.js';

const getMe = async (req, res) => {
  const db = getDB();
  try {
    const username = req.validateData.username;
    if (!username) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const doc = await db.collection('users').findOneAndUpdate(
      { username },
      { $setOnInsert: buildNewUserDocument({ username }) },
      { upsert: true, returnDocument: 'after' }
    );

    if (!doc) {
      return res.status(500).json({ message: 'Failed to load user profile' });
    }

    const validated = parseUserDocument(doc);
    res.send(buildUserMeResponse(validated));
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: error.message });
  }
};

const markHomeNotification = async (req, res) => {
  const db = getDB();
  try {
    const username = req.validateData.username;
    if (!username) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { name, action } = parseMarkHomeNotificationPayload(req.body);
    const nextStatus = action === 'clicked' ? 'clicked' : 'dismissed';

    const setFields = {
      'notifications.home.$.status': nextStatus
    };
    setFields['notifications.home.$.clickedOn'] = new Date();

    const after = await db.collection('users').findOneAndUpdate(
      {
        username,
        'notifications.home.name': name
      },
      { $set: setFields },
      { returnDocument: 'after' }
    );

    if (!after) {
      return res.status(404).json({ message: 'User or home notification not found' });
    }

    const validated = parseUserDocument(after);
    res.send(buildUserMeResponse(validated));
  } catch (error) {
    console.error('Error updating home notification:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

const setFavouriteTeam = async (req, res) => {
  const db = getDB();
  try {
    const username = req.validateData.username;
    if (!username) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id, name, favourite } = parseSetFavouriteTeamPayload(req.body);

    const existing = await db.collection('users').findOneAndUpdate(
      { username },
      { $setOnInsert: buildNewUserDocument({ username }) },
      { upsert: true, returnDocument: 'after' }
    );

    if (!existing) {
      return res.status(500).json({ message: 'Failed to load user profile' });
    }

    const parsed = parseUserDocument(existing);
    const teams = [...parsed.favouriteTeams];
    const idx = teams.findIndex((t) => t.id === id);
    if (favourite) {
      if (idx >= 0) {
        teams[idx] = { id, name };
      } else {
        teams.push({ id, name });
      }
    } else if (idx >= 0) {
      teams.splice(idx, 1);
    }

    const after = await db.collection('users').findOneAndUpdate(
      { username },
      { $set: { favouriteTeams: teams } },
      { returnDocument: 'after' }
    );

    if (!after) {
      return res.status(404).json({ message: 'User not found' });
    }

    const validated = parseUserDocument(after);
    await logUserAction(
      username,
      favourite ? 'ADD_FAVOURITE_TEAM' : 'REMOVE_FAVOURITE_TEAM',
      {
        teamId: id,
        teamName: name
      },
      {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    );
    res.send(buildUserMeResponse(validated));
  } catch (error) {
    console.error('Error updating favourite team:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

const setFavouriteLeague = async (req, res) => {
  const db = getDB();
  try {
    const username = req.validateData.username;
    if (!username) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id, name, favourite } = parseSetFavouriteLeaguePayload(req.body);

    const existing = await db.collection('users').findOneAndUpdate(
      { username },
      { $setOnInsert: buildNewUserDocument({ username }) },
      { upsert: true, returnDocument: 'after' }
    );

    if (!existing) {
      return res.status(500).json({ message: 'Failed to load user profile' });
    }

    const parsed = parseUserDocument(existing);
    const leagues = [...parsed.favouriteLeagues];
    const idx = leagues.findIndex((l) => l.id === id);
    if (favourite) {
      if (idx >= 0) {
        leagues[idx] = { id, name };
      } else {
        leagues.push({ id, name });
      }
    } else if (idx >= 0) {
      leagues.splice(idx, 1);
    }

    const after = await db.collection('users').findOneAndUpdate(
      { username },
      { $set: { favouriteLeagues: leagues } },
      { returnDocument: 'after' }
    );

    if (!after) {
      return res.status(404).json({ message: 'User not found' });
    }

    const validated = parseUserDocument(after);
    await logUserAction(
      username,
      favourite ? 'ADD_FAVOURITE_LEAGUE' : 'REMOVE_FAVOURITE_LEAGUE',
      {
        leagueId: id,
        leagueName: name
      },
      {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    );
    res.send(buildUserMeResponse(validated));
  } catch (error) {
    console.error('Error updating favourite league:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

export { getMe, markHomeNotification, setFavouriteTeam, setFavouriteLeague };
