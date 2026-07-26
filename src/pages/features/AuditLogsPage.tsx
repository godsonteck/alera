import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Clock,
  Download,
  Info,
  RefreshCcw,
  Search,
  ShieldAlert,
  User,
  XCircle,
} from 'lucide-react';

import { useAuth } from '@/contexts/useAuth';
import { api, type AdminUserRow, type AuditLogEntry, type AuditSummaryApiResponse } from '@/lib/apiService';
import { handleApiError } from '@/lib/errorHandler';

const severityIcons = {
  info: <Info className="w-4 h-4 text-info" />,
  warning: <AlertTriangle className="w-4 h-4 text-warning" />,
  critical: <XCircle className="w-4 h-4 text-destructive" />,
};

const severityStyles = {
  info: 'bg-info/10 text-info border-info/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
};

const normalizeSeverity = (severity?: string | null): keyof typeof severityStyles => {
  if (severity === 'warning' || severity === 'critical') return severity;
  return 'info';
};

const AuditLogsPage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [summary, setSummary] = useState<AuditSummaryApiResponse | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchAuditData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const results = await Promise.allSettled([
        api.audit.getLogs({
          skip: 0,
          limit: 200,
          search: search || undefined,
          user_id: userFilter !== 'all' ? Number(userFilter) : undefined,
          role: roleFilter !== 'all' ? roleFilter : undefined,
          status_filter: statusFilter !== 'all' ? statusFilter : undefined,
          action: actionFilter !== 'all' ? actionFilter : undefined,
          start_date: startDate ? new Date(startDate).toISOString() : undefined,
          end_date: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : undefined,
        }),
        api.audit.getSummary(7),
        api.admin.listAllUsers(0, 200),
      ]);

      const [logResult, summaryResult, usersResult] = results;
      const nextWarnings: string[] = [];

      if (logResult.status === 'fulfilled') {
        setLogs(logResult.value.items || []);
        setError('');
        setLastUpdatedAt(new Date().toISOString());
      } else {
        setLogs([]);
        setError(handleApiError(logResult.reason, 'load audit logs'));
      }

      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value);
      } else {
        setSummary(null);
        nextWarnings.push('Summary metrics are temporarily unavailable.');
      }

      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value || []);
      } else {
        setUsers([]);
        nextWarnings.push('User directory lookup is temporarily unavailable, so some rows may show raw user IDs.');
      }

      setWarnings(nextWarnings);

      if (logResult.status === 'fulfilled') {
        setSelectedLog((previous) => {
          if (!previous) return previous;
          return (logResult.value.items || []).find((entry) => entry.id === previous.id) || null;
        });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [actionFilter, endDate, roleFilter, search, startDate, statusFilter, userFilter]);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      void fetchAuditData();
    } else {
      setIsLoading(false);
    }
  }, [fetchAuditData, user?.role]);

  const userNameById = useMemo(
    () => new Map(users.map((entry) => [entry.id, `${entry.first_name} ${entry.last_name}`.trim() || entry.email])),
    [users],
  );

  const exportLogs = useCallback(async () => {
    try {
      const blob = await api.audit.exportLogs({
        user_id: userFilter !== 'all' ? Number(userFilter) : undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : undefined,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(handleApiError(err));
    }
  }, [actionFilter, endDate, roleFilter, search, startDate, statusFilter, userFilter]);

  if (user?.role !== 'super_admin') {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldAlert className="h-4 w-4" />
          Super Admin access required
        </div>
        <p className="mt-2 text-muted-foreground">Only the Super Admin can review system-wide audit and activity logs.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            Audit & Activity Tracking
            {isRefreshing && <RefreshCcw className="w-4 h-4 text-primary animate-spin" />}
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor authentication events, API activity, sensitive access, and operational anomalies.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void fetchAuditData()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors text-sm font-medium"
          >
            <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => void exportLogs()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 p-4 rounded-xl">
          {error}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Partial live data
          </div>
          <p className="mt-2">
            {warnings.join(' ')}
          </p>
        </div>
      )}

      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Logs (7d)</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{summary.total_logs}</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Failed Logins</div>
            <div className="mt-2 text-2xl font-bold text-warning">{summary.failed_logins}</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Critical Events</div>
            <div className="mt-2 text-2xl font-bold text-destructive">{summary.critical_events}</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Top Action</div>
            <div className="mt-2 text-sm font-semibold text-foreground">{summary.top_actions[0]?.action || '—'}</div>
          </div>
        </div>
      )}

      {lastUpdatedAt && (
        <div className="text-xs text-muted-foreground">
          Live data last refreshed {new Date(lastUpdatedAt).toLocaleString()}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="relative xl:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, IP, device, resource..."
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="h-11 px-4 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="all">All Users</option>
          {users.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {`${entry.first_name} ${entry.last_name}`.trim() || entry.email}
            </option>
          ))}
        </select>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="h-11 px-4 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="all">All Roles</option>
          {['patient', 'provider', 'pharmacist', 'hospital', 'laboratory', 'imaging', 'ambulance', 'physiotherapist', 'admin', 'super_admin'].map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-11 px-4 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="all">All Statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="warning">Warning</option>
        </select>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="h-11 px-4 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="all">All Actions</option>
          <option value="auth.login">Login Success</option>
          <option value="auth.login.failed">Login Failed</option>
          <option value="auth.logout">Logout</option>
          <option value="api.get">GET Requests</option>
          <option value="api.post">POST Requests</option>
          <option value="api.put">PUT Requests</option>
          <option value="api.delete">DELETE Requests</option>
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 px-4 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-11 px-4 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase px-5 py-3">Timestamp</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase px-5 py-3">Action</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase px-5 py-3">User</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase px-5 py-3">Resource</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase px-5 py-3">Network</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log, i) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.01 }}
                      className="border-b border-border last:border-0 hover:bg-secondary/30 transition cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-foreground">{log.action}</div>
                        <div className="text-xs text-muted-foreground mt-1">{log.request_method || log.resource_type || 'system'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm text-foreground">{log.user_id ? (userNameById.get(log.user_id) || `User ${log.user_id}`) : 'Anonymous'}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <User className="w-3 h-3" />
                          {log.role || 'unknown'}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm text-foreground max-w-xs truncate">{log.resource || log.resource_type || '—'}</div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">{log.description || log.request_path || '—'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm text-foreground">{log.ip_address || '—'}</div>
                        <div className="text-xs text-muted-foreground mt-1 max-w-xs truncate">{log.device_info || log.user_agent || 'Unknown device'}</div>
                      </td>
                      <td className="px-5 py-4">
                        {(() => {
                          const severity = normalizeSeverity(log.severity);
                          return (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${severityStyles[severity]}`}>
                              {severityIcons[severity]}
                              {log.status || severity}
                            </span>
                          );
                        })()}
                        {typeof log.duration_ms === 'number' && (
                          <div className="mt-1 text-xs text-muted-foreground">{log.duration_ms} ms</div>
                        )}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-display font-semibold text-foreground">Log Details</h2>
          {!selectedLog ? (
            <p className="mt-4 text-sm text-muted-foreground">Select an audit row to inspect session, device, and metadata details.</p>
          ) : (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Action</div>
                <div className="mt-1 text-foreground">{selectedLog.action}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">User</div>
                <div className="mt-1 text-foreground">{selectedLog.user_id ? (userNameById.get(selectedLog.user_id) || `User ${selectedLog.user_id}`) : 'Anonymous'}</div>
                <div className="text-xs text-muted-foreground mt-1">{selectedLog.role || 'unknown role'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Resource</div>
                <div className="mt-1 text-foreground break-all">{selectedLog.resource || selectedLog.request_path || selectedLog.resource_type || '—'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Network</div>
                <div className="mt-1 text-foreground">{selectedLog.ip_address || '—'}</div>
                <div className="text-xs text-muted-foreground mt-1">{selectedLog.device_info || selectedLog.user_agent || 'Unknown device'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Metadata</div>
                <pre className="mt-1 whitespace-pre-wrap rounded-xl bg-secondary/30 p-3 text-xs text-foreground overflow-x-auto">
                  {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogsPage;
