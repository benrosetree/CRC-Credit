import { useState, useContext, useEffect } from 'react';
import { CirclesSDKContext } from './CirclesSDKContext';
import { HeroStatsCard } from './components/HeroStatsCard';
import { LendPanel } from './components/LendPanel';
import { BorrowPanel } from './components/BorrowPanel';
import { MarketAskCard } from './components/MarketAskCard';
import { LandingPage } from './components/LandingPage';
import './App.css';

const calcEffectiveFee = (maxFee: number, amount: number, votes: number) => {
  if (votes <= amount) return maxFee;
  return Math.max(1, Math.round((maxFee * amount) / votes));
};

// Resolve IPFS URIs (ipfs://Qm...) to standard HTTP gateway URLs
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

// Parse flow string (e.g. "+2,400 CRC" -> 2400)
const parseNetFlow = (flowStr: string): number => {
  const cleaned = flowStr.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

// Calculate Expected Repayment Duration in Days
// Logical Speed Model:
// Repayment Speed is driven by Bob's Personal CRC Inflow Velocity.
// Because the CreditDAO has 100% allowance on Bob's wallet, the sweep bot grabs:
// 1. His guaranteed UBI (24 CRC/day)
// 2. 100% of any incoming CRC (cashbacks, purchases, etc.), which is reflected in his 7D Net Flow.
// Daily repayment capacity = 24 (UBI) + Max(0, 30D Net Flow / 30)
const calcRepaymentDuration = (amount: number, feePercentage: number, netFlow30d: string): number => {
  const dailyFlow = parseNetFlow(netFlow30d) / 30;
  const totalDailyRepayment = 24 + Math.max(0, dailyFlow);
  const totalDebt = amount * (1 + feePercentage / 100);
  return Math.max(1, totalDebt / totalDailyRepayment);
};

// Calculate True Annualized Voter APY: 
// Absolute Voter Yield * (365 / Expected Repayment Duration)
const calcVoterApy = (maxFee: number, amount: number, votes: number, netFlow30d: string) => {
  if (votes === 0) return maxFee.toFixed(1);
  const effectiveFee = calcEffectiveFee(maxFee, amount, votes);
  const utilization = Math.min(1, amount / votes);
  const absoluteYield = effectiveFee * utilization;
  
  const durationDays = calcRepaymentDuration(amount, effectiveFee, netFlow30d);
  const annualizedApy = absoluteYield * (365 / durationDays);
  
  return annualizedApy.toFixed(1);
};

const INITIAL_ASKS = [
  { id: 1, avatar: "0x11c23accba131a4230c54b8dfe76ea1e91a02dcd", amount: 1000, maxFee: 20, votes: 500, drawn: 0, repaid: 0, netFlow30d: "+4,200 CRC", backerType: "indirect" },
  { id: 2, avatar: "0x60de0884623630ab7667aa50128b6e3e10b32290", amount: 500, maxFee: 15, votes: 1500, drawn: 300, repaid: 150, netFlow30d: "+1,500 CRC", backerType: "direct" },
  { id: 3, avatar: "0x888a6b7600ce0806a971375ecd48e4fb54e51ede", amount: 5000, maxFee: 35, votes: 1200, drawn: 0, repaid: 0, netFlow30d: "+0 CRC", backerType: "none" }
];

function App() {
  const { sdk, address, isConnected } = useContext(CirclesSDKContext);
  const [activeTab, setActiveTab] = useState<'deposit' | 'vote' | 'borrow'>('deposit');
  const [hasEntered, setHasEntered] = useState(false);
  
  // Market State
  const [asks, setAsks] = useState(INITIAL_ASKS);
  const [userNetFlow30d, setUserNetFlow30d] = useState<string>("+0 CRC");

  // Profile State
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Sandbox State (Hidden by default for clean production-feel, toggled via floating pill)
  const [showSandbox, setShowSandbox] = useState(false);

  useEffect(() => {
    const fetchProfileAndFlow = async () => {
      if (!sdk || !address) return;
      try {
        // Fetch Profile via highly robust REST API to bypass IPFS gateway/CORS latency
        try {
          const res = await fetch(`https://rpc.aboutcircles.com/profiles/search?address=${address.toLowerCase()}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
              setProfileName(data[0].name || null);
              
              // Search only returns CID. We must query the get endpoint to fetch the actual PFP image data
              if (data[0].CID) {
                const pfpRes = await fetch(`https://rpc.aboutcircles.com/profiles/get?cid=${data[0].CID}`);
                if (pfpRes.ok) {
                  const pfpData = await pfpRes.json();
                  setProfileImage(resolveIpfsUrl(pfpData.previewImageUrl || pfpData.imageUrl));
                }
              }
            } else {
              const avatar = await sdk.getAvatar(address);
              if (avatar && avatar.profile) {
                const profile = await avatar.profile.get();
                if (profile) {
                  setProfileName(profile.name || null);
                  setProfileImage(resolveIpfsUrl(profile.previewImageUrl || profile.imageUrl));
                }
              }
            }
          }
        } catch (err) {
          console.warn("REST profile fetch failed, using SDK", err);
        }

        // Removed the unstable raw dynamic DB lookup that fell back to mocks,
        // since we now directly use real active human addresses in INITIAL_ASKS
        // which resolve automatically inside the MarketAskCard component.

        // Query the last 500 transactions to ensure we cover 30 days
        const query = sdk.data.getTransactionHistory(address, 500);
        const hasResults = await query.queryNextPage();
        if (hasResults) {
          const rows = query.currentPage.results;
          const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
          let incoming = 0;
          let outgoing = 0;
          for (const row of rows) {
            // timestamp from circles data is in seconds usually or ms
            const ts = String(row.timestamp).length < 13 ? row.timestamp * 1000 : row.timestamp;
            if (ts >= thirtyDaysAgo) {
              if (row.to.toLowerCase() === address.toLowerCase()) {
                incoming += row.timeCircles || 0;
              } else if (row.from.toLowerCase() === address.toLowerCase()) {
                outgoing += row.timeCircles || 0;
              }
            }
          }
          const net = incoming - outgoing;
          const formatted = `${net >= 0 ? '+' : ''}${net.toFixed(1)} CRC`;
          setUserNetFlow30d(formatted);
        }
      } catch (err) {
        console.error("Failed to fetch net flow", err);
      }
    };
    
    if (isConnected) {
      fetchProfileAndFlow();
    }
  }, [sdk, address, isConnected]);

  // Lock / veCRC State
  const [userLockedVotes, setUserLockedVotes] = useState(250);
  const [isPermalockActive, setIsPermalockActive] = useState(false);

  // Status Banners
  const [borrowStatus, setBorrowStatus] = useState<string | null>(null);
  const [lendStatus, setLendStatus] = useState<string | null>(null);

  const handleCreateAsk = async (amount: number, fee: number) => {
    if (!address) return;
    setBorrowStatus('Confirming ask...');
    try {
      setTimeout(() => {
        setBorrowStatus(`Success! Ask created.`);
        setAsks([{ 
          id: Date.now(), 
          avatar: profileName || `${address.substring(0,6)}...${address.substring(address.length-4)}`, 
          amount: amount, 
          maxFee: fee, 
          votes: 0, 
          drawn: 0,
          repaid: 0,
          netFlow30d: userNetFlow30d,
          backerType: "direct" // Logged-in user is a verified direct backer
        }, ...asks]);
      }, 1000);
    } catch (e: any) {
      setBorrowStatus(`Error: ${e.message}`);
    }
  };

  const handleLockCRC = async (amount: number, duration: number, permalock: boolean) => {
    if (!address) return;
    setLendStatus('Locking tokens...');
    try {
      setTimeout(() => {
        setLendStatus(`Success! Lock created.`);
        let calculatedPower = amount;
        if (!permalock) {
          const timeRatio = duration / 180;
          calculatedPower = Math.round(amount * timeRatio);
        }
        setUserLockedVotes(prev => prev + calculatedPower);
        setIsPermalockActive(permalock);
      }, 1000);
    } catch (e: any) {
      setLendStatus(`Error: ${e.message}`);
    }
  };

  const handleTogglePermalock = () => {
    setIsPermalockActive(prev => !prev);
  };

  const handleVote = (askId: number, amount: number) => {
    if (userLockedVotes < amount) {
      alert("Insufficient veCRC! Please lock more CRC above to gain voting power.");
      return;
    }
    setAsks(asks.map(a => a.id === askId ? { ...a, votes: a.votes + amount } : a));
    setUserLockedVotes(prev => prev - amount);
  };

  // Sandbox simulations
  const handleSimulateUBISweep = () => {
    setAsks(prevAsks => prevAsks.map(a => {
      if (a.id === 2 && a.drawn > 0) {
        const dailyFlow = parseNetFlow(a.netFlow30d) / 30;
        const speed = 24 + Math.max(0, dailyFlow);
        const newRepaid = Math.min(a.drawn * (1 + calcEffectiveFee(a.maxFee, a.amount, a.votes) / 100), a.repaid + speed);
        
        // Pro-rata unlock: free locked votes proportional to remaining debt ratio
        const ratio = (a.drawn * 1.1 - newRepaid) / (a.drawn * 1.1);
        setUserLockedVotes(prev => Math.min(1000, prev + Math.round(250 * (1 - ratio))));
        
        return { ...a, repaid: newRepaid };
      }
      return a;
    }));
    alert("Simulated a 24-Hour UBI Sweep! Pro-rata locks updated. Your unlocked veCRC is dynamically returned to your wallet as Bob repays.");
  };

  const handleSimulateCashback = () => {
    // Injects Gnosis Pay cashback into Ask #1
    setAsks(prevAsks => prevAsks.map(a => {
      if (a.id === 1) {
        // Trigger Bob to draw funds first so there is a debt to sweep
        const drawn = 500;
        const maxRepay = drawn * (1 + calcEffectiveFee(a.maxFee, a.amount, a.votes) / 100);
        const newRepaid = Math.min(maxRepay, a.repaid + 400); // Massive 400 CRC cashback payment!
        return { ...a, drawn, repaid: newRepaid };
      }
      return a;
    }));
    alert("Triggered Gnosis Pay Cashback! Simulated borrower 'Gnosis Spender' just spent on their card, and the sweep bot instantly captured 400 CRC to repay lenders.");
  };

  const handleSimulateFriendDeposit = () => {
    // Simulate someone clicking the user's invite link and depositing 1000 CRC for 180 days
    const boostPower = 1000 * 0.10; // 10% of 1000
    setUserLockedVotes(prev => prev + boostPower);
    alert(`A friend just used your invite link and locked 1,000 CRC! You earned an instant +${boostPower} veCRC voting power boost!`);
  };

  if (!isConnected) {
    return (
      <div className="miniapp-container circles-credit-app">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Connecting to Circles Wallet...</p>
        </div>
      </div>
    );
  }

  if (!hasEntered) {
    return <LandingPage onEnter={() => setHasEntered(true)} />;
  }

  return (
    <div className="miniapp-container circles-credit-app">
      {/* Mini App Header */}
      <header className="app-header">
        <div className="brand">
          <span className="logo-spark">✨</span>
          <h1>Circles Credit</h1>
        </div>
        <div className="connection-info">
          {/* Avatar Wrapper with Direct Backer Badge Overlay */}
          <div className="avatar-badge-wrapper">
            {profileImage ? (
              <img src={profileImage} alt="Avatar" className="header-pfp" />
            ) : (
              <div className="header-pfp-placeholder">👤</div>
            )}
            <div className="badge-overlay direct">
              <svg viewBox="0 0 10 10" width="8" height="8" className="svg-check">
                <path d="M2 5.5l2 2 4-4.5" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          
          <div className="header-user-details">
            <span className="address-badge">
              {profileName ? profileName : `${address?.substring(0, 6)}...${address?.substring(address.length - 4)}`}
            </span>
          </div>
          <span className="live-status-dot"></span>
        </div>
      </header>

      {/* Main Stats Card Component */}
      {activeTab !== 'borrow' && (
        <HeroStatsCard 
          userLockedVotes={userLockedVotes}
          isPermalockActive={isPermalockActive}
          onTogglePermalock={handleTogglePermalock}
          address={address}
        />
      )}

      {/* Tabs Switcher */}
      <div className="tabs-container">
        <button className={`tab-button ${activeTab === 'deposit' ? 'active' : ''}`} onClick={() => setActiveTab('deposit')}>
          Deposit
        </button>
        <button className={`tab-button ${activeTab === 'vote' ? 'active' : ''}`} onClick={() => setActiveTab('vote')}>
          Vote
        </button>
        <button className={`tab-button ${activeTab === 'borrow' ? 'active' : ''}`} onClick={() => setActiveTab('borrow')}>
          Borrow
        </button>
      </div>

      <main className="app-content">
        {activeTab === 'deposit' && (
          <div className="tab-content fade-in">
            <LendPanel onLock={handleLockCRC} lendStatus={lendStatus} />
          </div>
        )}

        {activeTab === 'vote' && (
          <div className="tab-content fade-in">
            {userLockedVotes < 1 && (
              <div className="warning-banner">
                You have no voting power. Go to the Deposit tab to lock CRC and gain veCRC.
              </div>
            )}
            <h4 className="section-header">Dynamic Credit Markets</h4>
            
            <div className={`asks-list ${userLockedVotes < 1 ? 'disabled-voting' : ''}`}>
              {asks.map(ask => (
                <MarketAskCard 
                  key={ask.id}
                  ask={ask as any}
                  calcEffectiveFee={calcEffectiveFee}
                  calcVoterApy={(maxFee, amt, vts) => calcVoterApy(maxFee, amt, vts, ask.netFlow30d)}
                  onVote={handleVote}
                  availablePower={userLockedVotes}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'borrow' && (
          <div className="tab-content fade-in">
            {/* Modular Borrow Panel Component */}
            <BorrowPanel onCreateAsk={handleCreateAsk} borrowStatus={borrowStatus} netFlow30d={userNetFlow30d} />
          </div>
        )}
      </main>

      {/* Floating Sandbox Control Drawer Overlay */}
      {showSandbox && (
        <div className="sandbox-bar fade-in">
          <div className="sandbox-header">
            <span>🛠️ Simulator Controls</span>
            <button className="sandbox-close-btn" onClick={() => setShowSandbox(false)}>×</button>
          </div>
          <p className="sandbox-desc">Speed up time and trigger card cashback actions to test FCFS proportional unlocks.</p>
          <div className="sandbox-actions">
            <button className="sandbox-action-btn" onClick={handleSimulateUBISweep}>
              ⏱️ Step Time (24h Sweep)
            </button>
            <button className="sandbox-action-btn" onClick={handleSimulateCashback}>
              🛒 Trigger Cashback (+400)
            </button>
            <button className="sandbox-action-btn" onClick={handleSimulateFriendDeposit}>
              🤝 Friend Joins (+10% veCRC)
            </button>
          </div>
        </div>
      )}

      {/* Floating action button to toggle Sim Controls, keeping main screen uncluttered */}
      <button className="floating-sandbox-toggle" onClick={() => setShowSandbox(!showSandbox)}>
        🛠️ Sandbox
      </button>
    </div>
  );
}

export default App;