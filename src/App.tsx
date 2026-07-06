import { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import UsernameGate from './components/UsernameGate';
import TaskBoard from './components/TaskBoard';
import ClaimView from './components/ClaimView';
import HistoryView from './components/HistoryView';
import EarningsView from './components/EarningsView';
import BottomNav from './components/BottomNav';
import Notification, { NotificationType } from './components/Notification';
import { Terminal, Power } from 'lucide-react';

export default function App() {
  const [username, setUsername] = useState<string | null>(null);
  const [view, setView] = useState<string>('board');
  const [activeClaim, setActiveClaim] = useState<any>(null);
  const [notification, setNotification] = useState<{ msg: string; type: NotificationType } | null>(null);

  useEffect(() => {
    document.title = import.meta.env.VITE_OPERATOR_NAME || 'CashPost';
    const storedUser = localStorage.getItem('redwire_username');
    if (storedUser) {
      setUsername(storedUser);
    }
    const storedClaim = localStorage.getItem('redwire_active_claim');
    if (storedClaim) {
      try {
        const claim = JSON.parse(storedClaim);
        if (new Date(claim.expires_at).getTime() > new Date().getTime()) {
          setActiveClaim(claim);
          setView('claim');
        } else {
          localStorage.removeItem('redwire_active_claim');
        }
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const handleLogin = (user: string) => {
    localStorage.setItem('redwire_username', user);
    setUsername(user);
    setView(activeClaim ? 'claim' : 'board');
  };

  const handleLogout = () => {
    localStorage.removeItem('redwire_username');
    localStorage.removeItem('redwire_active_claim');
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
    localStorage.setItem('redwire_active_claim', JSON.stringify(claimData));
    setView('claim');
  };

  const handleClearClaim = () => {
    setActiveClaim(null);
    localStorage.removeItem('redwire_active_claim');
  };

  if (!username) {
    return (
      <>
        <UsernameGate onLogin={handleLogin} showNotification={showNotification} />
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
        {view === 'history' && <HistoryView showNotification={showNotification} />}
        {view === 'earnings' && <EarningsView username={username} showNotification={showNotification} />}
      </main>

      <BottomNav currentView={view} setView={setView} hasActiveClaim={!!activeClaim} />

      <AnimatePresence>
        {notification && <Notification message={notification.msg} type={notification.type} onClose={() => setNotification(null)} />}
      </AnimatePresence>
    </div>
  );
}
