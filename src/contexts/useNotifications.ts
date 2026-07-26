import { useContext } from 'react';
import { NotificationContext } from './notification-context';

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be within NotificationProvider');
  return ctx;
};
