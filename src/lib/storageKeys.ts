const AUTH_USER_STORAGE_KEY = 'alera_user';
const AUTH_USERS_STORAGE_KEY = 'alera_mock_users';
const APP_DATA_STORAGE_KEY = 'alera_shared_app_data';
const CHAT_MESSAGES_STORAGE_KEY = 'alera_chat_messages_v1';
const NOTIFICATION_EVENT_STORAGE_KEY = 'alera_realtime_notification_event';
const NOTIFICATION_STORAGE_PREFIX = 'alera_notifications:';

export const storageKeys = {
  authUser: AUTH_USER_STORAGE_KEY,
  authUsers: AUTH_USERS_STORAGE_KEY,
  appData: APP_DATA_STORAGE_KEY,
  chatMessages: CHAT_MESSAGES_STORAGE_KEY,
  notificationEvent: NOTIFICATION_EVENT_STORAGE_KEY,
  notificationPrefix: NOTIFICATION_STORAGE_PREFIX,
} as const;

export const getAppDataStorageKey = (email: string) => {
  // Per-user cache prevents one user's mock/default data from leaking into another user's dashboard.
  return `alera_app_data:${encodeURIComponent(email.toLowerCase())}`;
};

export const getNotificationStorageKey = (email: string) =>
  `${NOTIFICATION_STORAGE_PREFIX}${email.toLowerCase()}`;

export const clearAleraStorage = () => {
  const keysToRemove: string[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    if (key.startsWith('alera_') || key.startsWith(NOTIFICATION_STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
};
