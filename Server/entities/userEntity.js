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
      home: [{ name: 'set_favourites', status: 'active' }]
    },
    createdOn: new Date()
  });

/** Response shape for GET /user/me: omits `_id` and only exposes active home notifications. */
const buildUserMeResponse = (parsed) => {
  const { _id, notifications, ...rest } = parsed;
  return {
    ...rest,
    notifications: {
      home: notifications.home.filter((n) => n.status === 'active')
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
