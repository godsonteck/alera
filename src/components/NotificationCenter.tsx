import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, CheckCheck, Trash2, AlertTriangle, Calendar, FlaskConical, Pill, MessageSquare, Settings, X } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useNotifications } from '@/contexts/useNotifications';
import { useNavigate } from 'react-router-dom';

const typeIcons: Record<string, React.ReactNode> = {
  appointment: <Calendar className="w-4 h-4" />,
  result: <FlaskConical className="w-4 h-4" />,
  prescription: <Pill className="w-4 h-4" />,
  reminder: <Bell className="w-4 h-4" />,
  alert: <AlertTriangle className="w-4 h-4" />,
  emergency: <AlertTriangle className="w-4 h-4" />,
  system: <Settings className="w-4 h-4" />,
  chat: <MessageSquare className="w-4 h-4" />,
};

const typeColors: Record<string, string> = {
  appointment: 'bg-primary/10 text-primary',
  result: 'bg-success/10 text-success',
  prescription: 'bg-info/10 text-info',
  reminder: 'bg-warning/10 text-warning',
  alert: 'bg-destructive/10 text-destructive',
  emergency: 'bg-destructive/10 text-destructive',
  system: 'bg-muted text-muted-foreground',
  chat: 'bg-accent/10 text-accent',
};

const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationCenter = ({ isOpen, onClose }: NotificationCenterProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllRead, clearAll, feedLabel, isLive, lastUpdatedAt } = useNotifications();
  const [filter, setFilter] = useState<string>('all');

  const activeNotifications = notifications.filter((notification) => !notification.archived);
  const filtered = filter === 'all' ? activeNotifications : activeNotifications.filter(n => n.type === filter);

  const handleNotificationClick = (id: string, actionUrl?: string) => {
    markAsRead(id);
    if (actionUrl) {
      navigate(actionUrl);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-96 bg-card rounded-2xl border border-border shadow-lg overflow-hidden z-50"
          >
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-card-foreground">Notifications</h3>
                <p className="text-xs text-muted-foreground">
                  {user?.name ? `${feedLabel} for ${user.name}` : feedLabel}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {isLive ? 'Live now' : 'Offline'}{unreadCount > 0 ? ` • ${unreadCount} unread` : ''}{lastUpdatedAt ? ` • updated ${formatTimeAgo(lastUpdatedAt)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <CheckCheck className="w-3 h-3" /> Mark all read
                  </button>
                )}
                {activeNotifications.length > 0 && (
                  <button onClick={clearAll} className="text-muted-foreground hover:text-foreground">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="px-4 py-2 flex gap-1.5 overflow-x-auto border-b border-border">
              {['all', 'emergency', 'appointment', 'result', 'prescription', 'reminder', 'chat'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition ${
                    filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
                  }`}>
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Notifications list */}
            <div className="max-h-80 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                filtered.map((n, i) => (
                  <motion.div
                    key={n.id}
                    initial={i < 3 ? { opacity: 0, x: -10 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => handleNotificationClick(n.id, n.actionUrl)}
                    className={`flex items-start gap-3 p-4 border-b border-border last:border-0 cursor-pointer hover:bg-secondary/30 transition ${
                      !n.read ? 'bg-primary/5' : ''
                    } ${n.priority === 'critical' ? 'bg-destructive/5 border-l-2 border-l-destructive' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeColors[n.type]}`}>
                      {typeIcons[n.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-card-foreground">{n.title}</span>
                        {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-muted-foreground">{formatTimeAgo(n.timestamp)}</p>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{n.audience}</span>
                        {n.actionUrl && <span className="text-[10px] uppercase tracking-wide text-primary">{n.actionLabel ?? 'Open'}</span>}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Emergency banner */}
            {activeNotifications.some(n => n.type === 'emergency' && !n.read) && (
              <div className="p-3 bg-destructive/10 border-t border-destructive/20 flex items-center gap-2">
                <div className="relative">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <div className="absolute inset-0 animate-pulse-ring">
                    <AlertTriangle className="w-4 h-4 text-destructive opacity-50" />
                  </div>
                </div>
                <span className="text-xs font-medium text-destructive">Active emergency alerts require attention</span>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationCenter;
