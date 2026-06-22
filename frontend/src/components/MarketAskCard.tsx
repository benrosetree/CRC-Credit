import React, { useState, useEffect } from 'react';

interface Ask {
  id: number;
  avatar: string;
  amount: number;
  maxFee: number;
  votes: number;
  drawn: number;
  repaid: number;
  netFlow30d: string;
  backerType: "direct" | "indirect" | "none";
}

interface MarketAskCardProps {
  ask: Ask;
  calcEffectiveFee: (maxFee: number, amount: number, votes: number) => number;
  calcVoterApy: (maxFee: number, amount: number, votes: number) => string | number;
  onVote: (askId: number, amount: number) => void;
  availablePower: number;
}

const parseNetFlow = (flowStr: string): number => {
  const cleaned = flowStr.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

const calcRepaymentDuration = (amount: number, feePercentage: number, netFlow7d: string): number => {
  const dailyFlow = parseNetFlow(netFlow7d) / 7;
  const totalDailyRepayment = 24 + Math.max(0, dailyFlow);
  const totalDebt = amount * (1 + feePercentage / 100);
  return Math.max(1, totalDebt / totalDailyRepayment);
};

const resolveIpfsUrl = (url?: string | null): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('ipfs://')) {
    return trimmed.replace('ipfs://', 'https://ipfs.aboutcircles.com/ipfs/');
  }
  if (trimmed.startsWith('Qm') || trimmed.startsWith('ba')) {
    return `https://ipfs.aboutcircles.com/ipfs/${trimmed}`;
  }
  return trimmed;
};

export const MarketAskCard: React.FC<MarketAskCardProps> = ({
  ask,
  calcEffectiveFee,
  calcVoterApy,
  onVote,
  availablePower,
}) => {
  const currentFee = calcEffectiveFee(ask.maxFee, ask.amount, ask.votes);
  const currentApy = calcVoterApy(ask.maxFee, ask.amount, ask.votes);
  const estDuration = calcRepaymentDuration(ask.amount, currentFee, ask.netFlow30d);

  // Dynamic Profile Loading for Real Users on the Market Board
  const [dispName, setDispName] = useState<string>(ask.avatar);
  const [dispPfp, setDispPfp] = useState<string | null>(null);
  
  // Custom vote input state
  const [voteInput, setVoteInput] = useState<string>('');

  useEffect(() => {
    const loadRealProfile = async () => {
      if (ask.avatar.startsWith('0x')) {
        try {
          const res = await fetch(`https://rpc.aboutcircles.com/profiles/search?address=${ask.avatar.toLowerCase()}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
              setDispName(data[0].name || ask.avatar);
              
              if (data[0].CID) {
                const pfpRes = await fetch(`https://rpc.aboutcircles.com/profiles/get?cid=${data[0].CID}`);
                if (pfpRes.ok) {
                  const pfpData = await pfpRes.json();
                  setDispPfp(resolveIpfsUrl(pfpData.previewImageUrl || pfpData.imageUrl));
                }
              }
            }
          }
        } catch (e) {
          console.warn("Card profile lookup failed", e);
        }
      }
    };
    loadRealProfile();
  }, [ask.avatar]);

  // Logical daily speed calculation
  const dailyFlow = parseNetFlow(ask.netFlow30d) / 30;
  const estDailyRepayment = 24 + Math.max(0, dailyFlow);

  const handleVoteSubmit = () => {
    const amt = Number(voteInput);
    if (!amt || amt <= 0) {
      alert("Please enter a valid vote amount.");
      return;
    }
    onVote(ask.id, amt);
    setVoteInput('');
  };

  return (
    <div className="market-ask-card">
      <div className="ask-header">
        <div className="ask-borrower-profile-row">
          <div className="avatar-badge-wrapper">
            {dispPfp ? (
              <img src={dispPfp} alt="Borrower" className="card-pfp-img" />
            ) : (
              <span className="card-pfp-placeholder-circle">👤</span>
            )}
            
            {/* Dynamic Gnosis App Backer / Indirect Backer Badge Overlays */}
            {ask.backerType === 'direct' && (
              <div className="badge-overlay card-badge direct" title="Direct Circles Backer">
                <svg viewBox="0 0 10 10" width="6" height="6" className="svg-check">
                  <path d="M2 5.5l2 2 4-4.5" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
            {ask.backerType === 'indirect' && (
              <div className="badge-overlay card-badge indirect" title="Indirect Circles Backer">
                <svg viewBox="0 0 10 10" width="6" height="6" className="svg-check">
                  <path d="M2 5.5l2 2 4-4.5" fill="none" stroke="#FF491B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
          <span className="borrower-address">{dispName.substring(0, 14)}{dispName.length > 14 ? '...' : ''}</span>
        </div>
        <div className="apy-value">{currentApy}% APY</div>
      </div>

      {/* Clean, single-row metrics strip replacing the bulky grid and speed box */}
      <div className="ask-metrics-strip">
        <span>Capacity: <strong>{ask.amount} CRC</strong></span>
        <span>Duration: <strong>{estDuration.toFixed(0)}d</strong></span>
        <span className="tooltip-custom-react">
          Repay Rate/Day ⓘ: <strong>{estDailyRepayment.toFixed(0)}</strong>
          <div className="tooltip-dropdown">
            <p className="tooltip-title">Composition:</p>
            <ul>
              <li>- daily mint allowance: 24</li>
              <li>- 30D avg net flow: {ask.netFlow30d}</li>
            </ul>
          </div>
        </span>
      </div>

      {ask.drawn > 0 && (
        <div className="status-pill-container mt-12">
          <div className="status-pill-header">
            <span className="status-pill-label">💸 Repayment Progress</span>
            <span className="status-pill-value green-text">{((ask.repaid / (ask.drawn * (1 + currentFee / 100))) * 100).toFixed(0)}%</span>
          </div>
          <div className="progress-track-mini multi-track">
            <div
              className="progress-bar-fill-mini green-fill"
              style={{
                width: `${
                  (ask.repaid / (ask.drawn * (1 + currentFee / 100))) * 100
                }%`,
              }}
            ></div>
          </div>
          <div className="status-pill-footer">
            <span>Oversubscribed Rate Locked: <strong>{currentFee}%</strong></span>
          </div>
        </div>
      )}

      {ask.drawn === 0 && (
        <div className="status-pill-container mt-12">
          <div className="status-pill-header">
            <span className="status-pill-label">📊 Backing Progress</span>
            <span className="status-pill-value">{((ask.votes / ask.amount) * 100).toFixed(0)}%</span>
          </div>
          <div className="progress-track-mini funding-track">
            <div
              className="progress-bar-fill-mini"
              style={{ width: `${Math.min((ask.votes / ask.amount) * 100, 100)}%` }}
            ></div>
          </div>
          <div className="status-pill-footer">
            {ask.votes >= ask.amount ? (
              <span className="warning-text">🔥 Oversubscribed! Fee reduced to <strong>{currentFee}%</strong></span>
            ) : (
              <span>Seeking <strong>{ask.amount}</strong> veCRC to execute.</span>
            )}
          </div>
        </div>
      )}

      <div className="vote-slider-container">
        <div className="slider-labels">
          <span className="slider-lbl">Allocated to vote</span>
          <span className="slider-val highlight-orange">{voteInput || 0} veCRC</span>
        </div>
        <input 
          type="range" 
          min="0" 
          max={availablePower} 
          value={voteInput || 0} 
          onChange={e => setVoteInput(e.target.value)} 
          className="theme-range-slider"
        />
        <button className="action-vote-btn mt-12" onClick={handleVoteSubmit} disabled={availablePower < 1 || Number(voteInput) === 0}>
          Vote
        </button>
      </div>
    </div>
  );
};
