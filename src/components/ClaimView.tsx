import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import { Copy, Check, ChevronRight } from 'lucide-react';

const RejectionModal: React.FC<{ isOpen: boolean; onClose: () => void; onSubmit: (reason: string) => void }> = ({ isOpen, onClose, onSubmit }) => {
  const [reason, setReason] = useState('');
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0b0f14] border border-red-500/40 p-6 max-w-md w-full">
        <h3 className="text-lg font-bold text-red-400 uppercase tracking-widest mb-2">Abort contract</h3>
        <p className="text-red-400/80 text-xs mb-4">Explain your reason in detail. Rejecting tasks without a proper reason may lead to suspension.</p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="reason..." className="w-full bg-black border border-slate-800 p-3 text-slate-200 text-sm mb-4 font-mono focus:outline-none focus:border-red-500/60" rows={3} />
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-200 text-xs font-bold uppercase tracking-widest px-3 py-2">Cancel</button>
          <button type="button" onClick={(e) => { e.preventDefault(); onSubmit(reason); }} disabled={reason.length < 10} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 text-xs uppercase tracking-widest disabled:opacity-40 transition-colors">Confirm</button>
        </div>
      </div>
    </div>
  );
};

interface ClaimViewProps {
  claim: any;
  onClearClaim: () => void;
  showNotification: (msg: string, type: 'success' | 'error' | 'warning') => void;
  setView: (view: string) => void;
}

export default function ClaimView({ claim, onClearClaim, showNotification, setView }: ClaimViewProps) {
  const [postUrl, setPostUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [expired, setExpired] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const expiresAt = claim.expiresAt || new Date(claim.expires_at).getTime();
      const now = new Date().getTime();
      const distance = expiresAt - now;
      if (distance < 0) {
        setExpired(true);
        setTimeLeft('00:00');
        return;
      }
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [claim.expires_at, claim.expiresAt]);

  const handleRejectConfirm = async (reason: string) => {
    setShowRejectModal(false);
    try {
      await apiFetch('/reject', { method: 'POST', body: JSON.stringify({ claim_id: claim.claim_id, reason }) });
      showNotification('Contract aborted', 'success');
      onClearClaim();
      setView('board');
    } catch (err: any) {
      showNotification(err.data?.message || 'Failed to reject task', 'error');
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    showNotification('Copied to buffer', 'success');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postUrl.startsWith('https://reddit.com/') && !postUrl.startsWith('https://www.reddit.com/')) {
      showNotification('Invalid target — link must be a direct https://reddit.com/ post', 'error');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/submit', { method: 'POST', body: JSON.stringify({ claim_id: claim.claim_id, post_url: postUrl }) });
      showNotification(`Transmitted // verifying post — $${Number(claim.payout).toFixed(2)} credits on clear`, 'success');
      onClearClaim();
      setView('history');
    } catch (err: any) {
      showNotification(err.data?.message || 'Failed to submit post URL', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (expired) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-64 border border-red-500/30 bg-[#0b0f14]">
        <h3 className="text-red-400 font-bold uppercase tracking-widest mb-2">Contract expired</h3>
        <p className="text-slate-500 text-xs mb-6 uppercase tracking-wider">You did not submit the post URL in time.</p>
        <button onClick={() => { onClearClaim(); setView('board'); }} className="bg-black border border-slate-700 hover:border-lime-400/60 text-slate-200 font-bold py-2 px-6 text-xs uppercase tracking-widest transition-colors">Back to feed</button>
      </div>
    );
  }

  // Terminal-style prompt line + section marker
  const Line = ({ marker, children }: { marker: string; children: React.ReactNode }) => (
    <div className="flex items-center gap-2 text-[10px] font-bold text-cyan-400/70 uppercase tracking-[0.25em] mb-2">
      <ChevronRight className="w-3 h-3 text-lime-400/70" />
      <span className="text-lime-400/60">{marker}</span>
      <span>{children}</span>
    </div>
  );

  return (
    <div className="pb-28 max-w-2xl mx-auto">
      <RejectionModal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} onSubmit={handleRejectConfirm} />

      {/* Terminal header bar */}
      <div className="bg-black border border-lime-400/30 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-lime-400/70" />
          <span className="ml-2 text-[10px] text-slate-500 tracking-widest font-mono">operator@cashpost ~ /contract/{claim.subreddit}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <div>
            <div className="font-mono text-slate-100 text-sm">r/{claim.subreddit.replace(/^r\//i, '')}</div>
            <div className="font-mono text-lime-300 text-sm">T-MINUS {timeLeft}</div>
          </div>
          <div className="text-2xl font-mono font-bold text-lime-300">${Number(claim.payout).toFixed(2)}</div>
        </div>
      </div>

      <div className="bg-amber-950/30 border-l-2 border-amber-400 p-3 mb-6">
        <p className="text-amber-300 text-xs font-mono">Keep the post live for at least 2 weeks after it clears. Early removal flags the node for suspension.</p>
      </div>

      {/* Single-column terminal flow */}
      <div className="space-y-6">
        {/* Requirements block */}
        <section>
          <Line marker="01">requirements</Line>
          <div className="bg-black border border-slate-800 p-3 space-y-3">
            {claim.verificationPeriodDays > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 uppercase tracking-wider">Verify time</span>
                <span className="text-xs font-bold text-cyan-300 border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5">{claim.verificationPeriodDays} Days</span>
              </div>
            )}
            {claim.flair && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 uppercase tracking-wider">Flair</span>
                <span className="bg-slate-800 text-slate-200 text-xs px-2 py-0.5 font-mono">{claim.flair}</span>
              </div>
            )}
            {claim.image_url && (
              <div className="flex flex-col gap-2">
                <span className="text-xs text-slate-500 uppercase tracking-wider">Asset</span>
                <a href={claim.image_url} target="_blank" rel="noreferrer" className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2 px-3 text-sm text-center uppercase tracking-widest transition-colors">View Image</a>
              </div>
            )}
            {claim.nsfw && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 uppercase tracking-wider">Safety</span>
                <span className="text-xs font-bold text-red-400 border border-red-500/30 bg-red-500/10 px-2 py-0.5">NSFW Tag Required</span>
              </div>
            )}
            {claim.first_comment && (
              <div className="block pt-2 border-t border-slate-800">
                <span className="text-xs text-slate-500 block mb-1 uppercase tracking-wider">Required First Comment</span>
                <code className="text-xs text-lime-300 bg-[#05070a] p-2 block w-full break-words border border-slate-800">{claim.first_comment}</code>
              </div>
            )}
            {!claim.verificationPeriodDays && !claim.flair && !claim.image_url && !claim.nsfw && !claim.first_comment && (
              <div className="text-xs text-slate-600 font-mono uppercase tracking-wider">// no additional constraints</div>
            )}
          </div>
        </section>

        {/* Payload: title */}
        <section>
          <div className="flex justify-between items-center">
            <Line marker="02">payload.title</Line>
            <button onClick={() => handleCopy(claim.post_content?.title || '', 'title')} className="text-slate-500 hover:text-lime-300 mb-2">{copiedField === 'title' ? <Check className="w-4 h-4 text-lime-300" /> : <Copy className="w-4 h-4" />}</button>
          </div>
          <textarea readOnly value={claim.post_content?.title || ''} className="w-full bg-black border border-slate-800 px-4 py-3 text-slate-200 focus:outline-none resize-none h-20 font-mono text-sm" />
        </section>

        {/* Payload: body */}
        <section>
          <div className="flex justify-between items-center">
            <Line marker="03">payload.body</Line>
            <button onClick={() => handleCopy(claim.post_content?.body || '', 'body')} className="text-slate-500 hover:text-lime-300 mb-2">{copiedField === 'body' ? <Check className="w-4 h-4 text-lime-300" /> : <Copy className="w-4 h-4" />}</button>
          </div>
          <textarea readOnly value={claim.post_content?.body || ''} className="w-full bg-black border border-slate-800 px-4 py-3 text-slate-200 focus:outline-none resize-y min-h-[150px] font-mono text-sm" />
        </section>

        {(claim.post_content?.note || claim.note_to_poster || claim.post_content?.note_to_poster) && (
          <section>
            <Line marker="04">instructions</Line>
            <div className="bg-black border-l-2 border-cyan-500/50 border-y border-r border-slate-800 p-4 text-slate-300 text-sm whitespace-pre-wrap">{claim.post_content?.note || claim.note_to_poster || claim.post_content?.note_to_poster}</div>
          </section>
        )}

        {claim.post_content?.hooks && claim.post_content.hooks.length > 0 && (
          <section>
            <Line marker="05">hooks</Line>
            <div className="space-y-2">
              {claim.post_content.hooks.map((hook: string, i: number) => (
                <div key={i} className="flex justify-between items-center bg-black border border-slate-800 px-3 py-2">
                  <span className="text-sm text-slate-300 truncate mr-2 font-mono">{hook}</span>
                  <button onClick={() => handleCopy(hook, `hook-${i}`)} className="text-slate-500 hover:text-lime-300 shrink-0">{copiedField === `hook-${i}` ? <Check className="w-4 h-4 text-lime-300" /> : <Copy className="w-4 h-4" />}</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Transmit */}
        <section className="border-t border-slate-800 pt-6">
          <form onSubmit={handleSubmit}>
            <Line marker="&gt;&gt;">transmit post url</Line>
            <input
              type="url"
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              placeholder="https://reddit.com/r/..."
              className="w-full bg-black border border-slate-800 px-4 py-3 text-lime-100 placeholder-slate-700 focus:outline-none focus:border-lime-400/60 transition-colors mb-3 font-mono text-sm"
              required
            />
            <button type="submit" disabled={loading || !postUrl.trim()} className="w-full bg-lime-400 hover:bg-lime-300 text-black font-bold py-3 uppercase tracking-[0.2em] text-sm transition-all disabled:opacity-40 flex justify-center items-center">
              {loading ? <div className="animate-spin border-black border-t-transparent rounded-full w-5 h-5 border-2" /> : 'Transmit post'}
            </button>
            <p className="text-slate-600 text-[10px] mt-2 text-center uppercase tracking-wider">URL must be a direct link to your Reddit post</p>
          </form>

          <div className="grid grid-cols-2 gap-3 pt-4 mt-4 border-t border-slate-800">
            <button onClick={() => setShowRejectModal(true)} className="py-2 px-3 text-xs font-bold border border-red-500/40 text-red-400 hover:bg-red-950/30 uppercase tracking-widest transition-colors">Abort</button>
            <button onClick={() => window.open(claim.targetPostUrl || `https://www.reddit.com/r/${claim.subreddit.replace('r/', '')}/`, 'RedditPost', 'width=850,height=700')} className="py-2 px-3 text-xs bg-cyan-500 hover:bg-cyan-400 text-black font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2">{claim.interaction_type === 'comment' ? 'Open Thread' : `Post to r/${claim.subreddit.replace(/^r\//i, '')}`}</button>
          </div>
        </section>
      </div>
    </div>
  );
}
