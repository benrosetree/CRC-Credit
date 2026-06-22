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
    // Generate a referral link for the Circles app
    const appUrl = 'https://app.aboutcircles.com/profile/'; // Or gnosis safe link
    const refAddress = address || '0xDemoRefAddress';
    navigator.clipboard.writeText(`${appUrl}${refAddress}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="hero-stats-card">
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
      </div>

      <div className="referral-banner">
        <div className="referral-content">
          <span className="referral-icon">🤝</span>
          <div className="referral-text">
            <strong>Refer & Earn</strong>
            <p>Get +10% veCRC power for every friend who connects via your invite link.</p>
          </div>
        </div>
        <button className="referral-btn" onClick={handleInvite}>
          {copied ? '✅ Copied' : 'Invite'}
        </button>
      </div>
    </>
  );
};
