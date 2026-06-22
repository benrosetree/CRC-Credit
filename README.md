# Circles CreditDAO 🔵

CreditDAO is a decentralized, undercollateralized P2P lending MiniApp built for the Circles v2 ecosystem. It leverages the unique mechanics of Circles—specifically the predictable UBI issuance—to create a trustless credit market where reputation and future UBI streams serve as collateral.

This project was built for the **Circles Garage Hackathon**.

## 🚀 The Concept

In traditional DeFi, lending requires overcollateralization (locking up $150 of ETH to borrow $100 of USDC). This is capital inefficient and leaves out users who need capital the most but have no existing assets to pledge. 

CreditDAO solves this by introducing **ve-Tokenomics** and **UBI Sweeping** to the Circles ecosystem.

1. **Lenders Lock CRC for veCRC:** Lenders lock their Circles (CRC) into the DAO for a specified duration (e.g., 7 to 180 days). In return, they receive `veCRC` (vote-escrowed CRC) representing their voting/lending power.
2. **Borrowers Create Asks:** A borrower publishes a "Credit Ask" requesting a certain amount of CRC, offering a maximum Dutch Auction fee (e.g., 5%).
3. **Dutch Auction Funding:** Lenders use their `veCRC` to back borrowers they trust. If an Ask is oversubscribed (receives more backing than requested), the interest rate/fee drops dynamically, ensuring borrowers get the best possible rate while lenders compete to provide liquidity.
4. **Continuous UBI Sweeping (Repayment):** Because every human on Circles receives 24 CRC per day, the DAO acts as an escrow. The smart contract continuously sweeps the borrower's incoming UBI (and any positive net flow from trust connections) to pay back the lenders in a First-In, First-Out (FIFO) chronological order.

## 🛠️ Features
- **ve-Tokenomics (Locking):** Incentivizes long-term liquidity by multiplying voting power based on lock duration (up to 180 days).
- **Dutch Yield Auction:** Creates a competitive market for interest rates, rewarding borrowers who have built strong social trust.
- **FIFO Repayments:** The earliest backers get repaid first, incentivizing quick funding of new Asks.
- **Circles UI Guidelines:** Pixel-perfect implementation of the Circles Brand Guidelines (Circles Blue, Circles Orange, flat UI, clean typography).
- **Sandbox Simulator:** A built-in mockup simulator for the UI to demonstrate UBI sweeping and repayments without requiring live testnet funds for every action.

## 📂 Repository Structure

*   `frontend/`: The React MiniApp built with Vite. Designed to run seamlessly inside the Gnosis Safe app ecosystem (or any Circles MiniApp host).
*   `contracts/`: The Solidity smart contracts containing the core logic for the CreditDAO, veCRC locking, Dutch Auctions, and the FIFO repayment queue.

## 🔗 Smart Contracts vs UI

For this hackathon submission, the **Frontend UI runs in a simulated Sandbox mode**. 
Given the short timeframe and the complexities of deploying and routing live transactions from an embedded iframe wallet, the UI is decoupled from the live smart contracts to provide a frictionless experience for the judges. 

The smart contracts (`contracts/CreditDAO.sol`) are fully written and included in the repository to demonstrate the exact on-chain mechanisms (FIFO queues, dynamic pro-rata lock duration math, permanent locks) that power the protocol's theory.

## 🏃‍♂️ How to Run the Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 📸 Screenshots

*(Add screenshots of the UI here)*

## 💡 Built With
*   React + TypeScript + Vite
*   Circles SDK / MiniApp SDK
*   Solidity (Hardhat)
*   Nethermind REST API (IPFS Profile Resolution)

## ⚖️ License
MIT