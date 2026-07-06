import React, { useState } from 'react';
import { motion } from 'motion/react';
import { apiFetch } from '../api';
import { Copy, Check, Terminal } from 'lucide-react';

interface UsernameGateProps {
  onLogin: (username: string) => void;
  showNotification: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export default function UsernameGate({ onLogin, showNotification }: UsernameGateProps) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'token'>('input');
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiFetch('/accounts/verify', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });

      if (res.status === 'verified' || res.status === 'already_registered') {
        onLogin(username);
      } else if (res.status === 'pending' && res.token) {
        setToken(res.token);
        setStep('token');
      } else {
        setErrorMsg(res.message || 'Verification is required to continue.');
      }
    } catch (err: any) {
      const error = err.data?.error || err.data?.message || '';
      if (err.status === 409 || error.includes('already_registered')) {
        setErrorMsg('This username is registered with another operator.');
      } else if (err.status === 404 || error === 'reddit_account_not_found') {
        setErrorMsg('Reddit account not found. Please check your spelling.');
      } else if (error === 'not_eligible') {
        setErrorMsg('Account not eligible. Requirements: 100+ Post/Comment Karma & 10+ days old.');
      } else {
        setErrorMsg(error || 'Failed to connect to verification server.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiFetch('/accounts/verify', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });

      if (res.status === 'verified' || res.status === 'already_registered') {
        showNotification('Node authenticated', 'success');
        onLogin(username);
      } else {
        setErrorMsg('Token not found in your bio yet. Make sure you saved your Reddit profile and try again.');
      }
    } catch (err: any) {
      const msg = err.data?.message || err.data?.error || '';
      if (msg === 'not_eligible') {
        setErrorMsg('Verification failed: Account does not meet karma/age requirements.');
      } else {
        setErrorMsg(msg || 'Verification failed. Please ensure the token is in your bio.');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    showNotification('Copied to buffer', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen cp-grid flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-[#0b0f14] border border-lime-400/25 cp-glow p-6"
      >
        <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-4">
          <Terminal className="w-5 h-5 text-lime-300" />
          <h1 className="text-lg font-bold text-lime-300 tracking-[0.15em] uppercase">
            {import.meta.env.VITE_OPERATOR_NAME || 'CashPost'}
          </h1>
          <span className="ml-auto text-[10px] text-cyan-400/60 tracking-widest">// node.access</span>
        </div>

        {step === 'input' ? (
          <form onSubmit={handleContinue} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-cyan-400/70 uppercase tracking-[0.2em] mb-2">
                &gt; reddit handle
              </label>
              <div className="flex items-center bg-black border border-slate-800 focus-within:border-lime-400/60 transition-colors">
                <span className="pl-3 text-lime-400/60 font-bold">u/</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="CyberFalcon847"
                  className="w-full bg-transparent px-2 py-3 text-lime-100 placeholder-slate-700 focus:outline-none font-mono"
                  required
                />
              </div>
            </div>
            {errorMsg && (
              <div className="text-red-400 text-xs bg-red-950/40 p-3 border-l-2 border-red-500">{errorMsg}</div>
            )}
            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full bg-lime-400 hover:bg-lime-300 text-black font-bold py-3 uppercase tracking-[0.2em] text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex justify-center items-center"
            >
              {loading ? <div className="animate-spin border-black border-t-transparent rounded-full w-5 h-5 border-2" /> : 'Authenticate'}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-cyan-300 uppercase tracking-[0.2em] mb-3">Verification token</h2>
              <div className="flex items-center justify-between bg-black px-4 py-3 border border-lime-400/30">
                <span className="font-mono text-xl text-lime-300 tracking-widest">{token}</span>
                <button onClick={copyToken} className="text-slate-500 hover:text-lime-300 transition-colors p-2">
                  {copied ? <Check className="w-5 h-5 text-lime-300" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-400 space-y-2 border-l-2 border-cyan-500/40 pl-3">
              <p>Inject this token into your Reddit profile "About" section, then run verify.</p>
              <p className="text-slate-600">reddit.com/settings &gt; Profile &gt; About &gt; inject token &gt; Save</p>
            </div>

            {errorMsg && (
              <div className="text-red-400 text-xs bg-red-950/40 p-3 border-l-2 border-red-500">{errorMsg}</div>
            )}

            <button
              onClick={handleVerify}
              disabled={loading}
              className="w-full bg-lime-400 hover:bg-lime-300 text-black font-bold py-3 uppercase tracking-[0.2em] text-sm transition-all disabled:opacity-40 flex justify-center items-center"
            >
              {loading ? <div className="animate-spin border-black border-t-transparent rounded-full w-5 h-5 border-2" /> : "I've added it — Verify"}
            </button>

            <button onClick={() => setStep('input')} className="w-full text-slate-600 hover:text-cyan-300 text-xs uppercase tracking-[0.2em] transition-colors">
              &lt; back
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
