import { apiFetch } from './api';
import { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import UsernameGate from './components/UsernameGate';
import TaskBoard from './components/TaskBoard';
import ClaimView from './components/ClaimView';
import HistoryView from './components/HistoryView';
import EarningsView from './components/EarningsView';
import BottomNav from './components/BottomNav';
import Landing from './components/Landing';
import Notification, { NotificationType } from './components/Notification';
import { Terminal, Power } from 'lucide-react';

export default function App() {
  const [username, setUsername] = useState<string | null>(null);
  const [view, setView] = useState<string>('board');
  const [showLogin, setShowLogin] = useState(false);
  const [activeClaim, setActiveClaim] = useState<any>(null);
  const [notification, setNotification] = useState<{ msg: string; type: NotificationType } | null>(null);

  useEffect(() => {
    document.title = import.meta.env.VITE_OPERATOR_NAME || 'CashPost';
    const storedUser = localStorage.getItem('cashpost_username');
    if (storedUser) {
      setUsername(storedUser);
    }
    const storedClaim = localStorage.getItem('cashpost_active_claim');
    if (storedClaim) {
      try {
        const claim = JSON.parse(storedClaim);
        if (new Date(claim.expires_at).getTime() > new Date().getTime()) {
          setActiveClaim(claim);
          setView('claim');
        } else {
          localStorage.removeItem('cashpost_active_claim');
        }
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const handleLogin = (user: string) => {
    localStorage.setItem('cashpost_username', user);
    setUsername(user);
    setView(activeClaim ? 'claim' : 'board');
  };

  const handleLogout = () => {
    if (activeClaim?.claim_id) {
      apiFetch('/release', { method: 'POST', body: JSON.stringify({ claim_id: activeClaim.claim_id }) }).catch(() => {});
    }
    localStorage.removeItem('cashpost_username');
    localStorage.removeItem('cashpost_active_claim');
    setUsername(null);
    setActiveClaim(null);
    setView('board');
  };

  const showNotification = (msg: string, type: NotificationType) => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleClaimSuccess = (claimData: any) => {
    setActiveClaim(claimData);
    localStorage.setItem('cashpost_active_claim', JSON.stringify(claimData));
    setView('claim');
  };

  const handleClearClaim = () => {
    setActiveClaim(null);
    localStorage.removeItem('cashpost_active_claim');
  };

  if (!username) {
    return (
      <>
        {showLogin ? (
          <>
            <button
              onClick={() => setShowLogin(false)}
              className="fixed top-4 left-4 z-50 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-lime-300 transition-colors"
            >
              &lt; back
            </button>
            <UsernameGate onLogin={handleLogin} showNotification={showNotification} />
          </>
        ) : (
          <Landing onGetStarted={() => setShowLogin(true)} />
        )}
        <AnimatePresence>
          {notification && <Notification message={notification.msg} type={notification.type} onClose={() => setNotification(null)} />}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-300">
      <header className="bg-[#080b10]/95 backdrop-blur border-b border-lime-400/20 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-lime-300" />
            <h1 className="text-base font-bold text-lime-300 tracking-[0.15em] uppercase">
              {import.meta.env.VITE_OPERATOR_NAME || 'CashPost'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-cyan-300">u/{username}</span>
            <button onClick={handleLogout} className="text-slate-600 hover:text-red-400 transition-colors" title="Not you?">
              <Power className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {view === 'board' && <TaskBoard username={username} onClaimSuccess={handleClaimSuccess} showNotification={showNotification} />}
        {view === 'claim' && activeClaim && <ClaimView claim={activeClaim} onClearClaim={handleClearClaim} showNotification={showNotification} setView={setView} />}
        {view === 'history' && <HistoryView username={username} showNotification={showNotification} />}
        {view === 'earnings' && <EarningsView username={username} showNotification={showNotification} />}
      </main>

      <BottomNav currentView={view} setView={setView} hasActiveClaim={!!activeClaim} />

      <AnimatePresence>
        {notification && <Notification message={notification.msg} type={notification.type} onClose={() => setNotification(null)} />}
      </AnimatePresence>
    </div>
  );
}
