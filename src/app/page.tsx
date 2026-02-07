'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Clock, Bot, Calendar, Zap, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

type CronJob = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: { kind: string; expr?: string; everyMs?: number; tz?: string };
  state?: { nextRunAtMs?: number; lastRunAtMs?: number; lastStatus?: string; lastError?: string };
  payload: { kind: string; model?: string };
};

type Agent = {
  id: string;
  configured: boolean;
};

type Session = {
  key: string;
  kind: string;
  channel: string;
  displayName?: string;
  model?: string;
  updatedAt: number;
  totalTokens: number;
};

function formatTime(ms: number) {
  const date = new Date(ms);
  return date.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true 
  });
}

function formatRelative(ms: number) {
  const now = Date.now();
  const diff = ms - now;
  const absDiff = Math.abs(diff);
  
  if (absDiff < 60000) return diff > 0 ? 'in <1m' : '<1m ago';
  if (absDiff < 3600000) return diff > 0 ? `in ${Math.round(absDiff / 60000)}m` : `${Math.round(absDiff / 60000)}m ago`;
  if (absDiff < 86400000) return diff > 0 ? `in ${Math.round(absDiff / 3600000)}h` : `${Math.round(absDiff / 3600000)}h ago`;
  return diff > 0 ? `in ${Math.round(absDiff / 86400000)}d` : `${Math.round(absDiff / 86400000)}d ago`;
}

function StatusBadge({ status }: { status?: string }) {
  if (status === 'ok') return <span className="flex items-center gap-1 text-xs text-green-500"><CheckCircle size={12} /> OK</span>;
  if (status === 'error') return <span className="flex items-center gap-1 text-xs text-red-500"><XCircle size={12} /> Error</span>;
  return <span className="flex items-center gap-1 text-xs text-gray-500"><AlertCircle size={12} /> Pending</span>;
}

export default function Dashboard() {
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'cron' | 'agents' | 'sessions'>('cron');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cronRes, agentsRes, sessionsRes] = await Promise.all([
        fetch('/api/cron'),
        fetch('/api/agents'),
        fetch('/api/sessions'),
      ]);
      
      const [cronData, agentsData, sessionsData] = await Promise.all([
        cronRes.json(),
        agentsRes.json(),
        sessionsRes.json(),
      ]);
      
      setCronJobs(cronData.jobs || []);
      setAgents(agentsData.agents || []);
      setSessions(sessionsData.sessions || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Fetch error:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <main className="min-h-screen bg-black text-white p-6 max-w-5xl mx-auto font-sans">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mission Control</h1>
          <p className="text-sm text-gray-500">Theo ⚔️ Agent Dashboard</p>
        </div>
        <button 
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      {/* Last Updated */}
      {lastRefresh && (
        <p className="text-xs text-gray-600 mb-6">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-800">
        <button 
          onClick={() => setActiveTab('cron')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'cron' 
              ? 'border-white text-white' 
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <Clock size={14} className="inline mr-2" />
          Cron Jobs ({cronJobs.length})
        </button>
        <button 
          onClick={() => setActiveTab('agents')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'agents' 
              ? 'border-white text-white' 
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <Bot size={14} className="inline mr-2" />
          Agents ({agents.length})
        </button>
        <button 
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'sessions' 
              ? 'border-white text-white' 
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <Zap size={14} className="inline mr-2" />
          Sessions ({sessions.length})
        </button>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {loading && (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        )}

        {/* Cron Jobs */}
        {!loading && activeTab === 'cron' && (
          <>
            {cronJobs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No cron jobs found. Make sure OpenClaw Gateway is running.
              </div>
            ) : (
              cronJobs.map((job) => (
                <div key={job.id} className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${job.enabled ? 'bg-green-500' : 'bg-gray-600'}`} />
                        <h3 className="font-medium text-white">{job.name}</h3>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {job.schedule.kind === 'cron' ? job.schedule.expr : `Every ${Math.round((job.schedule.everyMs || 0) / 60000)}m`}
                        </span>
                        {job.payload.model && (
                          <span className="text-gray-600">
                            {job.payload.model.split('/').pop()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={job.state?.lastStatus} />
                      {job.state?.nextRunAtMs && (
                        <p className="text-xs text-gray-600 mt-1">
                          Next: {formatRelative(job.state.nextRunAtMs)}
                        </p>
                      )}
                    </div>
                  </div>
                  {job.state?.lastError && (
                    <p className="mt-2 text-xs text-red-400 bg-red-950/30 px-2 py-1 rounded truncate">
                      {job.state.lastError.slice(0, 100)}...
                    </p>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {/* Agents */}
        {!loading && activeTab === 'agents' && (
          <>
            {agents.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No agents found.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {agents.map((agent) => (
                  <div key={agent.id} className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <Bot size={16} className={agent.configured ? 'text-green-500' : 'text-gray-600'} />
                      <span className="font-medium">{agent.id}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {agent.configured ? 'Configured' : 'Not configured'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Sessions */}
        {!loading && activeTab === 'sessions' && (
          <>
            {sessions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No active sessions.
              </div>
            ) : (
              sessions.map((session) => (
                <div key={session.key} className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-white">
                        {session.displayName || session.key.split(':').slice(-1)[0]}
                      </h3>
                      <div className="mt-1 flex gap-3 text-xs text-gray-500">
                        <span>{session.channel}</span>
                        <span>{session.kind}</span>
                        {session.model && <span className="text-gray-600">{session.model}</span>}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-600">
                      <p>{formatRelative(session.updatedAt)}</p>
                      <p>{session.totalTokens.toLocaleString()} tokens</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-gray-900 text-center text-xs text-gray-600">
        Sola Bible App • Mission Control v1.0
      </footer>
    </main>
  );
}
