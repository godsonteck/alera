import type { UserRole } from '@/contexts/AuthContext';
import type { NotificationDraft, RealtimeNotification } from '@/contexts/notification-context';

export const matchesNotificationRecipient = (draft: NotificationDraft, email: string, role: UserRole) => {
  const normalizedEmail = email.toLowerCase();
  const includesEmail = draft.targetEmails?.map((value) => value.toLowerCase()).includes(normalizedEmail) ?? false;
  const includesRole = draft.targetRoles?.includes(role) ?? false;
  const excluded = draft.excludeEmails?.map((value) => value.toLowerCase()).includes(normalizedEmail) ?? false;

  if (excluded) return false;
  if (!draft.targetEmails?.length && !draft.targetRoles?.length) return true;
  return includesEmail || includesRole;
};

export const createStoredNotification = (draft: NotificationDraft, role: UserRole): RealtimeNotification => ({
  id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: draft.title,
  message: draft.message,
  type: draft.type,
  read: false,
  archived: false,
  timestamp: new Date(),
  priority: draft.priority,
  audience: draft.audience,
  actionLabel: draft.actionLabel,
  actionUrl: draft.actionUrlByRole?.[role] ?? draft.actionUrl,
});
