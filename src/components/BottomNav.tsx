import { Terminal, Crosshair, History, Wallet } from 'lucide-react';

interface BottomNavProps {
  currentView: string;
  setView: (view: string) => void;
  hasActiveClaim: boolean;
}

export default function BottomNav({ currentView, setView, hasActiveClaim }: BottomNavProps) {
  const navItems = [
    { id: 'board', label: 'FEED', icon: <Terminal className="w-5 h-5" /> },
    { id: 'claim', label: 'ACTIVE', icon: <Crosshair className="w-5 h-5" />, disabled: !hasActiveClaim },
    { id: 'history', label: 'LOG', icon: <History className="w-5 h-5" /> },
    { id: 'earnings', label: 'VAULT', icon: <Wallet className="w-5 h-5" /> },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#080b10]/95 backdrop-blur border-t border-lime-400/20">
      <div className="flex justify-around items-stretch h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => !item.disabled && setView(item.id)}
              disabled={item.disabled}
              className={`relative flex flex-col items-center justify-center w-full gap-1 transition-colors ${
                active
                  ? 'text-lime-300'
                  : item.disabled
                    ? 'text-slate-700 cursor-not-allowed'
                    : 'text-slate-500 hover:text-cyan-300'
              }`}
            >
              {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 bg-lime-300 shadow-[0_0_10px_rgba(198,242,78,0.8)]" />}
              {item.icon}
              <span className="text-[9px] font-bold tracking-[0.2em]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
