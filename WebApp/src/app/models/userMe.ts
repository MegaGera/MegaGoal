/** Matches GET /user/me (active home notifications only). */

export type HomeNotificationStatus = 'active' | 'clicked' | 'dismissed';

export interface HomeNotification {
  name: string;
  status: HomeNotificationStatus;
  clickedOn?: string | null;
  message: string;
  actionPath: string;
  actionAriaLabel: string;
}

export interface UserMeNotifications {
  home: HomeNotification[];
}

export interface FavouriteTeamRef {
  id: number;
  name: string;
}

export interface FavouriteLeagueRef {
  id: number;
  name: string;
}

export interface UserMe {
  username: string;
  favouriteTeams: FavouriteTeamRef[];
  favouriteLeagues: FavouriteLeagueRef[];
  notifications: UserMeNotifications;
  createdOn: string;
}
