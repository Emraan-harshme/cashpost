import { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import { Submission } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { RefreshCw, FileText } from 'lucide-react';

interface HistoryViewProps {
  username: string;
  showNotification: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export default function HistoryView({ username, showNotification }: HistoryViewProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchHistory = async (isRefresh = false, nextCursor?: string) => {
    try {
      if (isRefresh) setRefreshing(true);
      const url = `/submissions?limit=50${nextCursor ? `&cursor=${nextCursor}` : ''}&username=${encodeURIComponent(username)}`;
      const data = await apiFetch(url);
      const newSubs = Array.isArray(data) ? data : data.submissions || [];
      if (nextCursor) {
        setSubmissions((prev) => [...prev, ...newSubs]);
      } else {
        setSubmissions(newSubs);
      }
      setCursor(data.next_cursor || null);
    } catch (err) {
      showNotification('Log sync failed', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const getStatusBadge = (status: string) => {
    const base = 'px-2 py-1 text-[9px] font-bold uppercase tracking-widest border';
    switch (status) {
      case 'cleared':
        return <span className={`${base} bg-lime-500/10 border-lime-500/30 text-lime-300`}>Cleared</span>;
      case 'failed':
        return <span className={`${base} bg-red-500/10 border-red-500/30 text-red-400`}>Failed</span>;
      case 'expired':
        return <span className={`${base} bg-slate-800 border-slate-700 text-slate-500`}>Expired</span>;
      case 'pending_verification':
      default:
        return <span className={`${base} bg-cyan-500/10 border-cyan-500/30 text-cyan-300`}>Pending</span>;
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="pb-28">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-sm font-bold text-slate-100 uppercase tracking-[0.2em]">// transmission log</h2>
        <button onClick={() => fetchHistory(true)} disabled={refreshing} className="text-slate-500 hover:text-lime-300 transition-colors p-2 disabled:opacity-50">
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center border border-slate-800 bg-[#0b0f14] h-64">
          <FileText className="w-12 h-12 text-slate-700 mb-4" />
          <h3 className="text-slate-400 font-bold uppercase tracking-widest">no transmissions</h3>
          <p className="text-slate-600 text-xs mt-2 uppercase tracking-wider">complete a contract to log activity</p>
        </div>
      ) : (
        <div className="border border-slate-800 bg-[#0b0f14]">
          <div className="divide-y divide-slate-800">
            {submissions.map((sub) => (
              <div key={sub.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-black/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <a href={sub.post_url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:text-lime-300 text-sm font-mono truncate block mb-1">
                    {sub.post_url.length > 40 ? sub.post_url.substring(0, 40) + '...' : sub.post_url}
                  </a>
                  <div className="text-slate-600 text-[10px] uppercase tracking-wider">
                    {new Date(sub.submitted_at).toLocaleDateString()} {new Date(sub.submitted_at).toLocaleTimeString()}
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  {getStatusBadge(sub.status)}
                  <span className={`font-mono font-bold ${sub.status === 'cleared' ? 'text-lime-300' : 'text-slate-600'}`}>${Number(sub.payout).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
          {cursor && (
            <div className="p-4 border-t border-slate-800 flex justify-center">
              <button onClick={() => { setLoadingMore(true); fetchHistory(false, cursor); }} disabled={loadingMore} className="text-xs font-bold text-lime-300 hover:text-lime-200 uppercase tracking-widest transition-colors">
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
