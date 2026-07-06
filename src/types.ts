export interface PosterAccount {
  username: string;
  status: 'active' | 'suspended' | 'pending';
  tier?: string;
  post_karma?: number;
  comment_karma?: number;
  days_old?: number;
}

export interface VerifyResponse {
  status: 'pending' | 'verified';
  token?: string;
  message?: string;
  post_karma?: number;
  comment_karma?: number;
  days_old?: number;
}

export interface Campaign {
  id: string;
  subreddits: string[];
  payout: number;
  tier: string;
  interaction_type: string;
  post_content?: {
    title: string;
    body: string;
    note?: string;
    hooks?: string[];
  };
  available_slots: number;
}

export interface ClaimResponse {
  claim_id: string;
  expires_at: string;
  campaign_id: string;
  subreddit: string;
  post_content: {
    title: string;
    body: string;
    note?: string;
    hooks?: string[];
  };
  payout: number;
}

export interface Submission {
  id: string;
  post_url: string;
  submitted_at: string;
  status: 'pending_verification' | 'cleared' | 'failed' | 'expired';
  payout: number;
}

export interface Balance {
  balance: number;
  pending_amount: number;
  lifetime_earnings: number;
}
