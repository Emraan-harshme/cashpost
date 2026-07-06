import { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import { Balance } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { DollarSign } from 'lucide-react';

interface EarningsViewProps {
  username: string;
  showNotification: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export default function EarningsView({ username, showNotification }: EarningsViewProps) {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const data = await apiFetch('/balance?username=' + encodeURIComponent(username));
        setBalance(data);
      } catch (err) {
        showNotification('Vault sync failed', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchBalance();
  }, []);

  if (loading) return <LoadingSpinner />;

  if (!balance) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border border-slate-800 bg-[#0b0f14] h-64">
        <DollarSign className="w-12 h-12 text-slate-700 mb-4" />
        <h3 className="text-slate-400 font-bold uppercase tracking-widest">vault offline</h3>
      </div>
    );
  }

  const cards = [
    { label: 'Available', value: balance.balance, color: 'text-lime-300', border: 'border-lime-400/30' },
    { label: 'Pending', value: balance.pending_amount, color: 'text-amber-300', border: 'border-amber-400/30' },
    { label: 'Lifetime', value: balance.lifetime_earnings, color: 'text-cyan-300', border: 'border-cyan-400/30' },
  ];

  return (
    <div className="pb-28 space-y-6">
      <h2 className="text-sm font-bold text-slate-100 uppercase tracking-[0.2em]">// vault</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`bg-[#0b0f14] border ${c.border} p-5`}>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">{c.label}</div>
            <div className={`text-3xl font-mono font-bold ${c.color}`}>${Number(c.value).toFixed(2)}</div>
          </div>
        ))}
      </div>

      <p className="text-slate-500 text-xs border-l-2 border-cyan-500/40 pl-3">
        Payouts are processed manually by your operator. Contact them directly to arrange withdrawal.
      </p>

      <div className="mt-8 pt-8 border-t border-slate-800">
        <h3 className="text-[10px] font-bold text-cyan-400/70 uppercase tracking-[0.2em] mb-4">Account Info</h3>
        <div className="bg-[#0b0f14] border border-slate-800 p-5 flex items-center justify-between">
          <div>
            <div className="text-lime-300 font-mono font-bold text-lg">u/{username}</div>
            <div className="text-slate-600 text-[10px] mt-1 uppercase tracking-widest">Registered Poster</div>
          </div>
          <div className="px-3 py-1 bg-lime-500/10 border border-lime-500/30 text-[10px] font-bold uppercase tracking-widest text-lime-300">Active</div>
        </div>
      </div>
    </div>
  );
}
