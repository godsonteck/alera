import { useMemo, useState } from 'react';
import { Archive, Bell, Check, CheckCircle, Inbox, MessageSquare, Search, Settings, AlertTriangle, FlaskConical, Pill, Calendar } from 'lucide-react';
import { useNotifications } from '@/contexts/useNotifications';

const typeIcons: Record<string, React.ReactNode> = {
  appointment: <Calendar className="w-3.5 h-3.5" />,
  result: <FlaskConical className="w-3.5 h-3.5" />,
  prescription: <Pill className="w-3.5 h-3.5" />,
  reminder: <Bell className="w-3.5 h-3.5" />,
  emergency: <AlertTriangle className="w-3.5 h-3.5" />,
  alert: <AlertTriangle className="w-3.5 h-3.5" />,
  system: <Settings className="w-3.5 h-3.5" />,
  chat: <MessageSquare className="w-3.5 h-3.5" />,
  referral: <Bell className="w-3.5 h-3.5" />,
};

const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const NotificationCenterPage = () => {
  const { notifications, unreadCount, markAsRead, markAllRead, archiveNotification } = useNotifications();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');

  const activeNotifications = useMemo(
    () => notifications.filter((notification) => !notification.archived),
    [notifications],
  );
  const archivedNotifications = useMemo(
    () => notifications.filter((notification) => notification.archived),
    [notifications],
  );

  const filtered = useMemo(() => {
    return activeNotifications.filter((notification) => {
      const matchesSearch = notification.title.toLowerCase().includes(search.toLowerCase()) || notification.message.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || notification.type === typeFilter;
      const matchesRead = readFilter === 'all' || (readFilter === 'unread' ? !notification.read : notification.read);
      return matchesSearch && matchesType && matchesRead;
    });
  }, [activeNotifications, readFilter, search, typeFilter]);

  const sorted = useMemo(
    () => [...filtered].sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime()),
    [filtered],
  );

  const stats = useMemo(() => ({
    total: activeNotifications.length,
    unread: unreadCount,
    archived: archivedNotifications.length,
  }), [activeNotifications.length, archivedNotifications.length, unreadCount]);

  return (
    <div className="space-y-4 font-mono text-[#ECEEF2]">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#090D14] border border-[#252A35] rounded-[4px]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#ECEEF2]">Notifications</span>
            <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.2 rounded font-mono">
              {stats.unread} UNREAD SIGNALS
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Appointment confirmations and updates from your care team.
          </p>
        </div>

        {stats.unread > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 bg-[#151922] hover:bg-slate-800 border border-cyan-500/60 text-cyan-300 font-bold px-3 py-1.5 rounded-[2px] text-xs transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>ACKNOWLEDGE ALL ({stats.unread})</span>
          </button>
        )}
      </div>

      {/* Stats Counters */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'ACTIVE', value: stats.total, color: 'text-[#ECEEF2]' },
          { label: 'UNREAD', value: stats.unread, color: 'text-amber-400' },
          { label: 'ARCHIVED', value: stats.archived, color: 'text-slate-500' },
        ].map((stat) => (
          <div key={stat.label} className="p-3 bg-[#090D14] border border-[#252A35] rounded-[2px] text-center">
            <div className="text-[10px] text-slate-500 uppercase">{stat.label}</div>
            <div className={`text-lg font-bold font-mono mt-0.5 ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filter and Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(['all', 'unread', 'read'] as const).map((rf) => (
            <button
              key={rf}
              onClick={() => setReadFilter(rf)}
              className={`px-3 py-1 rounded-[2px] text-xs font-mono uppercase tracking-wider border transition-colors ${
                readFilter === rf
                  ? 'bg-[#151922] border-cyan-500/60 text-cyan-300 font-semibold'
                  : 'bg-[#0F1218] border-[#252A35] text-slate-400 hover:text-[#ECEEF2]'
              }`}
            >
              {rf === 'all' ? 'ALL SIGNALS' : rf}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search alert signals..."
            className="w-full bg-[#0F1218] border border-[#252A35] focus:border-cyan-500 rounded-[2px] pl-9 pr-3 py-1.5 text-xs text-[#ECEEF2] placeholder:text-slate-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Notification List */}
      {sorted.length === 0 ? (
        <div className="p-8 text-center bg-[#090D14] border border-[#252A35] rounded-[4px] text-xs text-slate-500 font-mono">
          No matching notifications found.
        </div>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 bg-[#090D14] border rounded-[2px] flex items-start gap-3 text-xs ${
                !notification.read ? 'border-amber-600/40 bg-[#0F1218]' : 'border-[#252A35]'
              }`}
            >
              <div className="p-1.5 bg-[#151922] border border-[#2F3542] rounded-[2px] text-cyan-400 mt-0.5">
                {typeIcons[notification.type] || <Bell className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-[#ECEEF2]">{notification.title}</span>
                    {!notification.read && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono whitespace-nowrap">{formatTimeAgo(notification.timestamp)}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{notification.message}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[9px] bg-[#151922] border border-[#2F3542] px-1.5 py-0.2 rounded text-slate-400 uppercase font-mono">
                    {notification.type}
                  </span>
                  {notification.priority && notification.priority !== 'low' && (
                    <span className="text-[9px] bg-amber-950 border border-amber-800 px-1.5 py-0.2 rounded text-amber-300 uppercase font-mono">
                      {notification.priority}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {!notification.read && (
                  <button onClick={() => markAsRead(notification.id)} className="p-1 bg-[#151922] border border-[#2F3542] rounded-[2px] text-cyan-400 hover:bg-cyan-950" title="Acknowledge">
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => archiveNotification(notification.id)} className="p-1 bg-[#151922] border border-[#2F3542] rounded-[2px] text-slate-400 hover:text-red-400" title="Archive">
                  <Archive className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Archived Section */}
      {archivedNotifications.length > 0 && (
        <div className="border-t border-[#252A35] pt-4">
          <span className="text-[10px] font-bold text-slate-500 uppercase">ARCHIVED SIGNALS ({archivedNotifications.length})</span>
          <div className="space-y-1 mt-2">
            {archivedNotifications.slice(0, 5).map((notification) => (
              <div key={notification.id} className="p-2 bg-[#090D14] border border-[#1F232E] rounded-[2px] opacity-50 text-xs">
                <span className="font-bold text-slate-400">{notification.title}</span>
                <span className="text-[9px] text-slate-600 ml-2 font-mono">{formatTimeAgo(notification.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenterPage;
