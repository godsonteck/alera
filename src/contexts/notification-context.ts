import { createContext } from 'react';
import type { UserRole } from './AuthContext';

export interface RealtimeNotification {
  id: string;
  title: string;
  message: string;
  type: 'appointment' | 'result' | 'prescription' | 'emergency' | 'system' | 'chat' | 'reminder' | 'alert';
  read: boolean;
  archived: boolean;
  timestamp: Date;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  audience: 'personal' | 'role' | 'system';
  actionUrl?: string;
  actionLabel?: string;
}

export interface NotificationDraft {
  title: string;
  message: string;
  type: RealtimeNotification['type'];
  priority?: RealtimeNotification['priority'];
  audience: RealtimeNotification['audience'];
  actionUrl?: string;
  actionLabel?: string;
  actionUrlByRole?: Partial<Record<UserRole, string>>;
  targetRoles?: UserRole[];
  targetEmails?: string[];
  excludeEmails?: string[];
}

export interface NotificationContextType {
  notifications: RealtimeNotification[];
  unreadCount: number;
  isLive: boolean;
  feedLabel: string;
  lastUpdatedAt: Date | null;
  addNotification: (notif: NotificationDraft) => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  archiveNotification: (id: string) => void;
  clearAll: () => void;
}

export const NotificationContext = createContext<NotificationContextType | null>(null);
