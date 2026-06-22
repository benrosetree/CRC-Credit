import React, { useState } from 'react';

interface BorrowPanelProps {
  onCreateAsk: (amount: number, fee: number) => Promise<void>;
  borrowStatus: string | null;
  netFlow30d: string;
}

export const BorrowPanel: React.FC<BorrowPanelProps> = ({
  onCreateAsk,
  borrowStatus,
  netFlow30d,
}) => {
  const [amount, setAmount] = useState('1000');
  const [fee, setFee] = useState('20');

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid borrowing amount");
      return;
    }
    await onCreateAsk(Number(amount), Number(fee));
  };

  return (
    <div className="action-card text-center">
      <h3 className="card-title">Create Credit Ask</h3>
      <p className="card-description center-text">
        Set your credit parameters. You can draw CRC up to the votes you receive. Oversubscription automatically drops your fee!
      </p>

      <div className="theme-input-group mt-24 text-left">
        <label className="text-center-label">Max Capacity (CRC)</label>
        <div className="input-with-symbol">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="theme-input massive no-spinners"
          />
        </div>
      </div>

      <div className="theme-input-group mt-24 text-left">
        <label className="text-center-label">Max Fee Willing to Pay (%)</label>
        <div className="input-with-symbol">
          <input
            type="number"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="theme-input massive no-spinners"
          />
        </div>
      </div>

      <div className="borrow-details-panel mt-24 text-left">
        <div className="panel-row">
          <span className="text-secondary">30D Net Flow History</span>
          <span className={netFlow30d.startsWith('-') ? "flow-down" : "flow-up"}>{netFlow30d}</span>
        </div>
        <div className="panel-row">
          <span className="text-secondary">Repayment Strategy</span>
          <span className="text-primary-bold">100% UBI Sweep</span>
        </div>
        <div className="panel-row highlight mt-12 pt-12">
          <span className="text-primary-bold">Max Repayment</span>
          <span className="text-primary-bold">{(Number(amount) * (1 + Number(fee) / 100)).toFixed(0)} CRC</span>
        </div>
      </div>

      <button className="primary-theme-btn mt-24" onClick={handleSubmit}>
        Publish Ask
      </button>

      {borrowStatus && <div className="status-banner success mt-16">{borrowStatus}</div>}
    </div>
  );
};

