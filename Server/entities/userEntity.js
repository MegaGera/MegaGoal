import { z } from 'zod';

const favouriteTeamRefSchema = z.object({
  id: z.number().int(),
  name: z.string()
});

const favouriteLeagueRefSchema = z.object({
  id: z.number().int(),
  name: z.string()
});

const notificationStatusSchema = z.enum(['active', 'clicked', 'dismissed']);

const homeNotificationSchema = z.object({
  name: z.string(),
  status: notificationStatusSchema,
  clickedOn: z.coerce.date().nullable().optional()
});

const notificationsSchema = z.object({
  home: z.array(homeNotificationSchema)
});

/** Add new home banners here — exactly one entry must have catalogActive: true. */
const HOME_NOTIFICATION_CATALOG = [
  {
    name: 'set_favourites',
    catalogActive: false,
    message:
      'You can now add your favourite teams and leagues! Give it a try by clicking on the star on a team or league page, and watch it in the profile page',
    actionPath: '/app/profile',
    actionAriaLabel: 'Open profile'
  },
  {
    name: 'match_reactions_voting',
    catalogActive: true,
    message:
      'Reactions and player voting are here! Open any match, share how the game felt, and vote for your favourite players.',
    actionPath: '/app/matches',
    actionAriaLabel: 'Browse matches'
  }
];

const catalogActiveEntries = HOME_NOTIFICATION_CATALOG.filter((entry) => entry.catalogActive);
if (catalogActiveEntries.length !== 1) {
  throw new Error(
    `HOME_NOTIFICATION_CATALOG must have exactly one catalogActive entry, found ${catalogActiveEntries.length}`
  );
}

const catalogActiveNotification = catalogActiveEntries[0];

const buildDefaultHomeNotifications = () => [
  { name: catalogActiveNotification.name, status: 'active' }
];

const findMissingHomeNotifications = (home) => {
  const existingNames = new Set(home.map((n) => n.name));
  return buildDefaultHomeNotifications().filter((n) => !existingNames.has(n.name));
};

/** Core user profile fields stored in the `users` collection (without Mongo `_id`). */
const userProfileSchema = z.object({
  username: z.string().min(1),
  favouriteTeams: z.array(favouriteTeamRefSchema),
  favouriteLeagues: z.array(favouriteLeagueRefSchema),
  notifications: notificationsSchema,
  createdOn: z.coerce.date()
});

const userDocumentSchema = userProfileSchema.extend({
  _id: z.any().optional()
});

const parseUserDocument = (document) => userDocumentSchema.parse(document);
const parseUserDocuments = (documents) => z.array(userDocumentSchema).parse(documents);

const buildNewUserDocument = ({ username }) =>
  userProfileSchema.parse({
    username,
    favouriteTeams: [],
    favouriteLeagues: [],
    notifications: {
      home: buildDefaultHomeNotifications()
    },
    createdOn: new Date()
  });

/** Response shape for GET /user/me: omits `_id`; returns at most the catalog-active home notification. */
const buildUserMeResponse = (parsed) => {
  const { _id, notifications, ...rest } = parsed;
  const userNotification = notifications.home.find(
    (n) => n.name === catalogActiveNotification.name && n.status === 'active'
  );

  return {
    ...rest,
    notifications: {
      home: userNotification
        ? [
            {
              name: userNotification.name,
              status: userNotification.status,
              clickedOn: userNotification.clickedOn ?? null,
              message: catalogActiveNotification.message,
              actionPath: catalogActiveNotification.actionPath,
              actionAriaLabel: catalogActiveNotification.actionAriaLabel
            }
          ]
        : []
    }
  };
};

const markHomeNotificationPayloadSchema = z.object({
  name: z.string().min(1),
  action: z.enum(['clicked', 'dismissed'])
});

const parseMarkHomeNotificationPayload = (body) => markHomeNotificationPayloadSchema.parse(body);

const setFavouriteTeamPayloadSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  favourite: z.boolean()
});

const parseSetFavouriteTeamPayload = (body) => setFavouriteTeamPayloadSchema.parse(body);

const setFavouriteLeaguePayloadSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  favourite: z.boolean()
});

const parseSetFavouriteLeaguePayload = (body) => setFavouriteLeaguePayloadSchema.parse(body);

export {
  buildNewUserDocument,
  buildUserMeResponse,
  findMissingHomeNotifications,
  HOME_NOTIFICATION_CATALOG,
  markHomeNotificationPayloadSchema,
  favouriteLeagueRefSchema,
  favouriteTeamRefSchema,
  homeNotificationSchema,
  notificationStatusSchema,
  notificationsSchema,
  parseMarkHomeNotificationPayload,
  parseSetFavouriteLeaguePayload,
  parseSetFavouriteTeamPayload,
  parseUserDocument,
  parseUserDocuments,
  userDocumentSchema,
  userProfileSchema
};
