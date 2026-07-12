import { useState } from 'react';
import { motion } from 'motion/react';
import { signInWithDiscord } from '../discord';
import { Terminal, Zap, ShieldCheck, Wallet, ChevronRight } from 'lucide-react';

interface LandingProps {
  onGetStarted: () => void;
  onDiscordLogin?: (username: string) => void;
}

export default function Landing({ onGetStarted, onDiscordLogin }: LandingProps) {
  const [discordBusy, setDiscordBusy] = useState(false);

  const handleDiscord = async () => {
    setDiscordBusy(true);
    try {
      const du = await signInWithDiscord();
      if (du?.discordId && onDiscordLogin) {
        try {
          const baseUrl = import.meta.env.VITE_GATEWAY_URL;
          if (baseUrl) {
            const meResp = await fetch(`${baseUrl}/v1/me`, { headers: { 'x-discord-id': du.discordId } });
            if (meResp.ok) {
              const me = await meResp.json();
              if (me?.linked && me?.redditUsername) { setDiscordBusy(false); onDiscordLogin(me.redditUsername); return; }
            }
          }
        } catch {}
      }
    } catch {}
    setDiscordBusy(false);
    onGetStarted();
  };

  const brand = import.meta.env.VITE_OPERATOR_NAME || 'CashPost';
  return (
    <div className="min-h-screen cp-grid text-slate-300">
      <header className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-lime-300" />
          <span className="font-bold text-lime-300 tracking-[0.15em] uppercase">{brand}</span>
        </div>
        <button onClick={onGetStarted} className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-lime-300 transition-colors">
          log in &gt;
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4">
        <section className="pt-16 pb-20 grid lg:grid-cols-2 gap-10 items-center">
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}>
            <div className="inline-flex items-center gap-2 border border-lime-400/30 bg-lime-400/5 px-3 py-1 mb-6">
              <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-lime-300">payouts online</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
              Get paid to post.<br />
              <span className="text-lime-300">Settled in crypto.</span>
            </h1>
            <p className="text-slate-400 font-mono text-sm mb-8 max-w-md">
              {brand} routes real Reddit tasks to your queue. Claim a contract, post it, submit the link — get paid per clear. No fluff.
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={onGetStarted} className="bg-lime-400 hover:bg-lime-300 text-black font-bold py-3 px-6 uppercase tracking-[0.2em] text-sm transition-all flex items-center gap-2">
                <Zap className="w-4 h-4" /> Initialize session
              </button>
              <button onClick={onGetStarted} className="border border-slate-700 hover:border-lime-400/60 text-slate-200 font-bold py-3 px-6 uppercase tracking-[0.2em] text-sm transition-colors">
                I have an account
              </button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-black border border-lime-400/30 cp-glow">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-lime-400/70" />
              <span className="ml-2 text-[10px] text-slate-500 font-mono tracking-widest">~/{brand.toLowerCase()}/feed</span>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-300 leading-relaxed overflow-hidden">
{`> auth --reddit u/CyberFalcon847
  [ok] node verified

> contracts --open
  r/deals        $4.50   [claim]
  r/buildapc     $6.25   [claim]
  r/personalfin  $8.00   [claim]

> vault --balance
  available   $141.75
  pending     $8.00`}
            </pre>
          </motion.div>
        </section>

        <section className="grid sm:grid-cols-3 gap-4 pb-20">
          {[
            { icon: <Zap className="w-5 h-5" />, t: 'Claim in one tap', d: 'Open contracts stream straight to your feed.' },
            { icon: <ShieldCheck className="w-5 h-5" />, t: 'Reddit-verified', d: 'Link your account once with a bio token.' },
            { icon: <Wallet className="w-5 h-5" />, t: 'Crypto payouts', d: 'Track available, pending and lifetime in the vault.' },
          ].map((f) => (
            <div key={f.t} className="bg-[#0b0f14] border border-slate-800 p-5">
              <div className="text-lime-300 mb-3">{f.icon}</div>
              <h3 className="text-white font-bold text-sm mb-1">{f.t}</h3>
              <p className="text-slate-500 text-xs">{f.d}</p>
            </div>
          ))}
        </section>

        <section className="pb-24 text-center">
          <button onClick={onGetStarted} className="inline-flex items-center gap-2 bg-lime-400 hover:bg-lime-300 text-black font-bold py-3 px-8 uppercase tracking-[0.2em] text-sm transition-all">
            Start earning <ChevronRight className="w-4 h-4" />
          </button>
          <p className="text-slate-600 text-[10px] uppercase tracking-widest mt-3">you'll verify your Reddit account after login</p>
        </section>
      </main>

      {window.location.search.includes('share=') && (
        <div className="max-w-lg mx-auto mt-4 px-4">
          <div className="bg-blue-600/10 border border-blue-400/30 rounded-xl px-4 py-3 text-center">
            <span className="text-sm font-bold text-blue-400">📨 You've been invited to a task!</span>
            <p className="text-xs text-blue-300/70 mt-1">Sign in to claim it — we'll route you straight there.</p>
          </div>
        </div>
      )}
      <footer className="border-t border-slate-800 py-6 text-center text-slate-600 text-[10px] font-mono tracking-widest uppercase">
        {brand} · the poster network
      </footer>
    </div>
  );
}
