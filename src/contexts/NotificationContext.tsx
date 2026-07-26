import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { type UserRole } from './AuthContext';
import { NotificationContext, type NotificationDraft, type NotificationContextType, type RealtimeNotification } from './notification-context';
import { useAuth } from './useAuth';
import { createStoredNotification, matchesNotificationRecipient } from '@/lib/notificationUtils';
import { notificationsApi } from '@/lib/apiService';
import { normalizeUserRole } from '@/lib/roleUtils';

interface BackendNotification {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  is_archived: boolean;
  created_at: string;
  action_url?: string | null;
}

const MAX_NOTIFICATIONS = 50;

const roleFeedLabels: Record<UserRole, string> = {
  patient: 'Patient activity',
  doctor: 'Doctor activity',
  hospital: 'Hospital activity',
  laboratory: 'Laboratory activity',
  imaging: 'Imaging activity',
  pharmacy: 'Pharmacy activity',
  ambulance: 'Emergency activity',
  admin: 'Admin activity',
  super_admin: 'Super Admin activity',
};

const mapBackendNotification = (notification: BackendNotification, role: UserRole): RealtimeNotification => ({
  id: String(notification.id),
  title: notification.title,
  message: notification.message,
  type: (notification.notification_type as RealtimeNotification['type']) || 'system',
  read: notification.is_read,
  archived: notification.is_archived,
  timestamp: new Date(notification.created_at),
  priority: notification.notification_type === 'alert' || notification.notification_type === 'emergency' ? 'critical' : 'medium',
  audience: 'personal',
  actionUrl: notification.action_url || undefined,
  actionLabel: role === 'admin' ? 'Open' : 'View',
});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user || !isAuthenticated) {
      setNotifications([]);
      setLastUpdatedAt(null);
      return [];
    }

    try {
      const response = await notificationsApi.listNotifications(0, MAX_NOTIFICATIONS);
      const mapped = (Array.isArray(response) ? response : []).map((item) =>
        mapBackendNotification(item as BackendNotification, normalizeUserRole(user.role) ?? user.role),
      );
      setNotifications(mapped);
      setLastUpdatedAt(mapped[0]?.timestamp ?? null);
      return mapped;
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
      setLastUpdatedAt(null);
      return [];
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (isAuthenticated && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [isAuthenticated]);

  const addNotification = useCallback(async (draft: NotificationDraft) => {
    if (!user) return;

    const uiRole = normalizeUserRole(user.role) ?? user.role;
    if (!matchesNotificationRecipient(draft, user.email, uiRole)) return;

    const optimistic = createStoredNotification(draft, uiRole);
    setNotifications((prev) => [optimistic, ...prev].slice(0, MAX_NOTIFICATIONS));
    setLastUpdatedAt(optimistic.timestamp);

    if (draft.priority === 'critical' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(optimistic.title, { body: optimistic.message, icon: '/alera-icon.png' });
    }

    try {
      await notificationsApi.createNotification({
        title: draft.title,
        message: draft.message,
        notification_type: draft.type,
        action_url: draft.actionUrlByRole?.[uiRole] ?? draft.actionUrl,
      });
      await loadNotifications();
    } catch (error) {
      console.error('Failed to persist notification:', error);
      toast.error('Notification saved locally but could not be synced to the server.');
    }

    if (draft.audience !== 'system') {
      toast(optimistic.title, {
        description: optimistic.message,
      });
    }
  }, [loadNotifications, user]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark notification read:', error);
    }
  }, [loadNotifications]);

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllAsRead();
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark all notifications read:', error);
    }
  }, [loadNotifications]);

  const archiveNotification = useCallback(async (id: string) => {
    try {
      await notificationsApi.archiveNotification(id);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to archive notification:', error);
    }
  }, [loadNotifications]);

  const clearAll = useCallback(async () => {
    try {
      await notificationsApi.deleteAllNotifications();
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    } finally {
      setNotifications([]);
      setLastUpdatedAt(null);
    }
  }, []);

  const unreadCount = notifications.filter((notification) => !notification.read && !notification.archived).length;
  const feedRole = user ? normalizeUserRole(user.role) ?? user.role : null;
  const feedLabel =
    feedRole && feedRole in roleFeedLabels ? roleFeedLabels[feedRole as UserRole] : 'Activity';

  const contextValue = useMemo<NotificationContextType>(() => ({
    notifications,
    unreadCount,
    isLive: isAuthenticated && !!user,
    feedLabel,
    lastUpdatedAt,
    addNotification,
    markAsRead,
    markAllRead,
    archiveNotification,
    clearAll,
  }), [notifications, unreadCount, isAuthenticated, user, feedLabel, lastUpdatedAt, addNotification, markAsRead, markAllRead, archiveNotification, clearAll]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};
