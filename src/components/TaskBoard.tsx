import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { apiFetch } from '../api';
import { Campaign } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { Inbox, Zap } from 'lucide-react';

interface TaskBoardProps {
  username: string;
  onClaimSuccess: (claimData: any) => void;
  showNotification: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export default function TaskBoard({ username, onClaimSuccess, showNotification }: TaskBoardProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const data = await apiFetch('/campaigns');
      setCampaigns(Array.isArray(data) ? data : data.campaigns || []);
    } catch (err) {
      showNotification('Contract feed unreachable', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (campaignId: string, subreddit: string) => {
    setClaimingId(`${campaignId}-${subreddit}`);
    try {
      const res = await apiFetch('/claim', {
        method: 'POST',
        body: JSON.stringify({ campaign_id: campaignId, username, subreddit }),
      });

      const campaign = campaigns.find((c) => c.id === campaignId);

      const enrichedClaim = {
        claim_id: res.claim_id,
        expires_at: res.expires_at,
        expiresAt: new Date(res.expires_at).getTime(),
        campaign_id: campaignId,
        subreddit,
        payout: campaign?.payout ?? 0,
        post_content: campaign?.post_content ?? null,
        tier: campaign?.tier ?? null,
        interaction_type: campaign?.interaction_type ?? 'post',
        verificationPeriodDays: (campaign as any)?.verificationPeriodDays ?? 0,
        flair: (campaign as any)?.flair ?? null,
        image_url: (campaign as any)?.image_url ?? null,
        nsfw: (campaign as any)?.nsfw ?? false,
        first_comment: (campaign as any)?.first_comment ?? null,
        targetPostUrl: (campaign as any)?.targetPostUrl ?? null,
        assigned_comment: (res as any)?.assigned_comment ?? null,
        assigned_comment_index: (res as any)?.assigned_comment_index ?? null,
      };

      if (String(enrichedClaim.interaction_type || '').toLowerCase().includes('comment') && (campaign as any)?.post_content?.prewrittenComments?.length) {
        const cmts = (campaign as any).post_content.prewrittenComments as string[];
        const assigned = (enrichedClaim as any).assigned_comment as string | null;
        enrichedClaim.post_content = {
          ...((campaign as any)?.post_content || {}),
          title: assigned ? 'Post exactly this comment' : 'Pick ONE comment to post',
          body: assigned ? assigned : cmts.map((c, i) => `${i + 1}. ${c}`).join('\n\n'),
        } as any;
      }

      if (enrichedClaim.post_content && /quick launch/i.test(String((enrichedClaim.post_content as any)?.note || ''))) {
        enrichedClaim.post_content = { ...(enrichedClaim.post_content as any), note: '' } as any;
      }

      onClaimSuccess(enrichedClaim);
    } catch (err: any) {
      if (err.data?.error === 'no_slots_available') {
        showNotification('Slot locked by another operator. Re-scan.', 'error');
        fetchCampaigns();
      } else {
        showNotification(err.data?.error || err.data?.message || 'Failed to claim task', 'error');
      }
    } finally {
      setClaimingId(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-64 border border-slate-800 bg-[#0b0f14]">
        <Inbox className="w-12 h-12 text-slate-700 mb-4" />
        <h3 className="text-slate-400 font-bold uppercase tracking-widest">no contracts live</h3>
        <p className="text-slate-600 text-xs mt-2 uppercase tracking-wider">re-scan later for open bounties</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-cyan-400/60 px-1">
        <span>// open contracts [{campaigns.length}]</span>
        <span className="text-lime-400/60">operator: {import.meta.env.VITE_OPERATOR_NAME || 'cashpost'}</span>
      </div>
      {campaigns.map((camp, i) => (
        <motion.div
          key={camp.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="bg-[#0b0f14] border border-slate-800 hover:border-lime-400/40 transition-colors relative"
        >
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-lime-400 to-cyan-400" />
          <div className="p-4 pl-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-slate-100 text-lg">
                  {camp.subreddits.length === 1 ? `r/${camp.subreddits[0].replace(/^r\//i, '')}` : `${camp.subreddits.length} targets`}
                </h3>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-black border border-cyan-500/30 text-[9px] font-bold uppercase text-cyan-300 tracking-widest">{camp.tier}</span>
                  <span className="px-2 py-0.5 bg-black border border-slate-700 text-[9px] font-bold uppercase text-slate-400 tracking-widest">{camp.interaction_type}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-mono font-bold text-lime-300 leading-none">${Number(camp.payout).toFixed(2)}</div>
                <span className={`text-[9px] uppercase tracking-widest ${camp.available_slots === 1 ? 'text-amber-400' : 'text-slate-600'}`}>
                  {camp.available_slots} slot{camp.available_slots !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {camp.post_content && (
              <div className="mb-4 bg-black/60 border border-slate-800 p-3">
                <h4 className="text-slate-200 text-sm font-medium mb-1">{camp.post_content.title}</h4>
                <p className="text-slate-500 text-xs line-clamp-2">{camp.post_content.body}</p>
              </div>
            )}

            {camp.subreddits.length === 1 ? (
              <button
                onClick={() => handleClaim(camp.id, camp.subreddits[0])}
                disabled={claimingId !== null}
                className="w-full bg-lime-400 hover:bg-lime-300 text-black font-bold py-2.5 uppercase tracking-[0.2em] text-xs transition-all disabled:opacity-40 flex justify-center items-center gap-2"
              >
                {claimingId === `${camp.id}-${camp.subreddits[0]}` ? (
                  <div className="animate-spin border-black border-t-transparent rounded-full w-4 h-4 border-2" />
                ) : (
                  <><Zap className="w-4 h-4" /> Claim contract</>
                )}
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {camp.subreddits.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => handleClaim(camp.id, sub)}
                    disabled={claimingId !== null}
                    className="bg-black border border-slate-700 hover:border-lime-400/60 p-2 text-left text-xs font-bold text-slate-200 flex justify-between items-center transition-colors"
                  >
                    <span>r/{sub.replace(/^r\//i, '')}</span>
                    {claimingId === `${camp.id}-${sub}` && <div className="animate-spin border-lime-400 border-t-transparent rounded-full w-3 h-3 border-2" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
