import React, { useState } from 'react';

interface LendPanelProps {
  onLock: (amount: number, duration: number, permalock: boolean) => Promise<void>;
  lendStatus: string | null;
}

export const LendPanel: React.FC<LendPanelProps> = ({ onLock, lendStatus }) => {
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState(180); // Default to 180 days (6 months)
  const [permalock, setPermalock] = useState(false);

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid CRC amount");
      return;
    }
    await onLock(Number(amount), duration, permalock);
    setAmount('');
  };

  const getPowerMultiplier = () => {
    return (duration / 180).toFixed(2);
  };

  const formatDaysToMonths = (days: number) => {
    if (days === 180) return "6 Months (Max)";
    if (days === 7) return "7 Days (Min)";
    
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    
    if (months > 0) {
      return `${months} Month${months > 1 ? 's' : ''}${remainingDays > 0 ? ` ${remainingDays} Day${remainingDays > 1 ? 's' : ''}` : ''}`;
    }
    return `${days} Days`;
  };

  return (
    <div className="action-card text-center">
      <h3 className="card-title">Lock CRC for veCRC</h3>
      <p className="card-description center-text">
        Power credit lines and earn rewards. Less than 6 months lock scales power proportionally.
      </p>

      <div className="input-row-vertical">
        <input
          type="number"
          placeholder="0.00 CRC"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="theme-input massive no-spinners"
        />
        
        {/* Lock Duration Slider */}
        <div className="slider-group text-left">
          <div className="slider-labels">
            <span className="slider-lbl">Duration</span>
            <span className="slider-val highlight-orange">{formatDaysToMonths(duration)}</span>
          </div>
          <input 
            type="range" 
            min="7" 
            max="180" 
            value={duration} 
            onChange={(e) => setDuration(Number(e.target.value))}
            className="theme-range-slider"
          />
          <div className="power-multiplier-indicator">
            <span>Voting Power Multiplier:</span>
            <strong>{getPowerMultiplier()}x</strong>
          </div>
        </div>
      </div>

      {/* Permalock sliding toggle */}
      <div className="permalock-toggle-container text-left mt-16">
        <div className="permalock-texts">
          <span className="permalock-title-text">Permalock</span>
          <span className="permalock-desc-text">Saves max voting power permanently.</span>
        </div>
        <button
          type="button"
          className={`permalock-switch ${permalock ? 'active' : ''}`}
          onClick={() => setPermalock(!permalock)}
        >
          <span className="switch-handle"></span>
        </button>
      </div>

      <button className="primary-theme-btn mt-24" onClick={handleSubmit}>
        Mint veCRC
      </button>

      {lendStatus && <div className="status-banner success mt-16">{lendStatus}</div>}
    </div>
  );
};
