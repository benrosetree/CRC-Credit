import React, { useState } from 'react';

interface HeroStatsCardProps {
  userLockedVotes: number;
  isPermalockActive: boolean;
  onTogglePermalock: () => void;
  address?: string | null;
}

export const HeroStatsCard: React.FC<HeroStatsCardProps> = ({
  userLockedVotes,
  isPermalockActive,
  onTogglePermalock,
  address
}) => {
  const [copied, setCopied] = useState(false);

  const handleInvite = () => {
    // Generate a referral link that points to the current deployment
    const baseUrl = window.location.origin;
    const refAddress = address || '0xDemoRefAddress';
    navigator.clipboard.writeText(`${baseUrl}?ref=${refAddress}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="hero-stats-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div className="hero-left">
        <p className="hero-label">Your Voting Power</p>
        <h2 className="hero-value">
          {userLockedVotes} <span className="hero-unit">veCRC</span>
        </h2>
        <div className="hero-pills">
          <span className={`hero-badge ${isPermalockActive ? 'badge-perma' : ''}`}>
            {isPermalockActive ? '🔒 Permalocked' : '⏳ Decaying Lock'}
          </span>
          <button className="text-action-btn" onClick={onTogglePermalock}>
            {isPermalockActive ? 'Unlock Decay' : 'Activate Permalock'}
          </button>
        </div>
      </div>
      
      <div className="hero-right" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
        <p className="hero-label" style={{ margin: 0 }}>Refer & Earn</p>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '140px' }}>
          Get +10% veCRC power for every friend who connects.
        </p>
        <button 
          className="action-vote-btn" 
          onClick={handleInvite}
          style={{ width: 'auto', padding: '8px 16px', marginTop: '4px' }}
        >
          {copied ? '✅ Link Copied!' : 'Copy Invite Link'}
        </button>
      </div>
    </div>
  );
};
