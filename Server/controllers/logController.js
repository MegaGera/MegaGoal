import { getChannel, isConnected } from '../config/rabbitmq.js';

// Log user action to RabbitMQ
const logUserAction = async (username, action, details = {}, metadata = {}) => {
  try {
    if (!isConnected()) {
      console.warn('RabbitMQ not connected, skipping log');
      return;
    }

    const channel = getChannel();
    const logMessage = {
      timestamp: new Date(),
      service: 'megagoal',
      microservice: 'server',
      username: username,
      action: action,
      details: details,
      metadata: {
        ip: metadata.ip || 'unknown',
        userAgent: metadata.userAgent || 'unknown',
        ...metadata
      }
    };

    await channel.sendToQueue(
      'logging',
      Buffer.from(JSON.stringify(logMessage)),
      { persistent: true } // Make message persistent
    );

    console.log(`User action logged: ${username} - ${action}`);
  } catch (error) {
    console.error('Failed to log user action:', error.message);
    // Don't throw error to avoid breaking the main flow
  }
};

// Specific action loggers following your app patterns
const logMatchCreated = async (username, matchData, req) => {
  await logUserAction(
    username,
    'MATCH_CREATED',
    {
      matchId: matchData._id,
      fixture: matchData.fixture,
      league: matchData.league,
      teams: matchData.teams,
    },
    {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  );
};

const logMatchDeleted = async (username, matchData, req) => {
  await logUserAction(
    username,
    'MATCH_DELETED',
    {
      matchId: matchData._id,
      fixture: matchData.fixture,
      league: matchData.league,
      teams: matchData.teams,
    },
    {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  );
};

const logMatchUpdateLocation = async (username, data, req) => {
  await logUserAction(
    username,
    'MATCH_UPDATE_LOCATION',
    {
      fixtureId: data.fixtureId,
      location: data.location
    },
    {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  );
};

// Send message to mailing queue
const sendMailingMessage = async (email, username, template = 'feedback') => {
  try {
    if (!isConnected()) {
      console.warn('RabbitMQ not connected, skipping mailing message');
      return;
    }

    const channel = getChannel();
    const mailingMessage = {
      recipient: email,
      template,
      username
    };

    await channel.sendToQueue(
      'mailing',
      Buffer.from(JSON.stringify(mailingMessage)),
      { persistent: true } // Make message persistent
    );

    console.log(`Mailing message sent: ${email} - ${template} template`);
  } catch (error) {
    console.error('Failed to send mailing message:', error.message);
    // Don't throw error to avoid breaking the main flow
  }
};

const logFeedbackSubmitted = async (username, feedbackData, req) => {
  await logUserAction(
    username,
    'FEEDBACK_SUBMITTED',
    {
      feedbackId: feedbackData._id,
      type: feedbackData.type || 'general'
    },
    {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  );
};

const logAdminAction = async (username, action, details, req) => {
  await logUserAction(
    username,
    `ADMIN_${action.toUpperCase()}`,
    details,
    {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      role: 'admin'
    }
  );
};

const logPageVisit = async (username, pageName, pageData = {}, req) => {
  await logUserAction(
    username,
    `VIEW_PAGE_${pageName.toUpperCase().replace(/-/g, '_')}`,
    {
      page: pageName,
      ...pageData
    },
    {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  );
};

export {
  logUserAction,
  logMatchCreated,
  logMatchUpdateLocation,
  logMatchDeleted,
  logFeedbackSubmitted,
  logAdminAction,
  sendMailingMessage,
  logPageVisit
}; 