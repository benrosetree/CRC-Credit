import React from 'react';

interface HeroStatsCardProps {
  userLockedVotes: number;
  isPermalockActive: boolean;
  onTogglePermalock: () => void;
}

export const HeroStatsCard: React.FC<HeroStatsCardProps> = ({
  userLockedVotes,
  isPermalockActive,
  onTogglePermalock,
}) => {
  return (
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
  );
};
