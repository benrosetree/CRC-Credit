// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

interface IHubV2 {
    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata data) external;
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

contract CreditDAO is ERC1155Holder {
    IERC1155 public immutable hub;
    uint256 public immutable daoCurrencyId;
    
    struct Lock {
        uint256 amount;
        uint256 end;
        bool permalocked;
    }
    
    struct Ask {
        address borrower;
        uint256 maxAmount;       // Max CRC they want to borrow
        uint256 maxFeePercentage; // e.g., 20% max fee they are willing to pay
        uint256 totalVotes;      // Total veCRC voted for this ask
        uint256 amountDrawn;     // CRC already withdrawn by the borrower
        uint256 amountRepaid;    // CRC repaid by the borrower (includes principal + interest)
        uint256 fixedFeeAtDraw;  // The exact fee percentage permanently fixed at the first draw
        uint256 borrowerPersonalCurrencyId;
        bool closed;
    }
    
    mapping(address => Lock) public locks;
    mapping(uint256 => Ask) public asks;
    uint256 public askCounter;
    
    // Tracks the active votes for a voter in an ask
    mapping(uint256 => mapping(address => uint256)) public askVotes;
    
    uint256 public constant MAX_LOCK = 180 days; // 6 Months max lock
    uint256 public totalDeposits;

    event Deposited(address indexed user, uint256 amount, uint256 lockDuration, bool permalocked);
    event PermalockToggled(address indexed user, bool permalocked);
    event Withdrawn(address indexed user, uint256 amount);
    event AskCreated(uint256 indexed askId, address indexed borrower, uint256 maxAmount, uint256 maxFeePercentage);
    event Voted(uint256 indexed askId, address indexed voter, uint256 veAmount);
    event VoteWithdrawn(uint256 indexed askId, address indexed voter, uint256 veAmount);
    event FundsDrawn(uint256 indexed askId, uint256 amount, uint256 fixedFeePercentage);
    event UBISwept(uint256 indexed askId, uint256 amount);

    constructor(address _hub, uint256 _daoCurrencyId) {
        hub = IERC1155(_hub);
        daoCurrencyId = _daoCurrencyId;
    }
    
    function deposit(uint256 amount, uint256 lockDuration, bool permalock) external {
        require(amount > 0, "Amount must be > 0");
        require(lockDuration <= MAX_LOCK, "Exceeds max lock");
        require(lockDuration > 0, "Must lock for > 0");
        
        hub.safeTransferFrom(msg.sender, address(this), daoCurrencyId, amount, "");
        
        locks[msg.sender].amount += amount;
        locks[msg.sender].end = block.timestamp + lockDuration;
        locks[msg.sender].permalocked = permalock;
        totalDeposits += amount;
        
        emit Deposited(msg.sender, amount, lockDuration, permalock);
    }

    function lockPermanent() external {
        Lock storage userLock = locks[msg.sender];
        require(userLock.amount > 0, "No active lock");
        require(!userLock.permalocked, "Already permalocked");
        
        userLock.permalocked = true;
        userLock.end = 0; // Stop time-based calculations
        
        emit PermalockToggled(msg.sender, true);
    }

    function unlockPermanent() external {
        Lock storage userLock = locks[msg.sender];
        require(userLock.amount > 0, "No active lock");
        require(userLock.permalocked, "Not permalocked");
        
        userLock.permalocked = false;
        userLock.end = block.timestamp + MAX_LOCK; // Re-initiate decay
        
        emit PermalockToggled(msg.sender, false);
    }
    
    function getVotingPower(address user) public view returns (uint256) {
        Lock memory userLock = locks[user];
        if (userLock.amount == 0) return 0;
        
        if (userLock.permalocked) {
            return userLock.amount;
        }
        
        if (block.timestamp >= userLock.end) {
            return 0;
        }
        
        uint256 timeRemaining = userLock.end - block.timestamp;
        return (userLock.amount * timeRemaining) / MAX_LOCK;
    }
    
    function withdraw(uint256 amount) external {
        Lock storage userLock = locks[msg.sender];
        require(userLock.amount >= amount, "Insufficient lock balance");
        require(!userLock.permalocked, "Unlock permalock first");
        require(block.timestamp >= userLock.end, "Lock period active");
        
        userLock.amount -= amount;
        totalDeposits -= amount;
        
        hub.safeTransferFrom(address(this), msg.sender, daoCurrencyId, amount, "");
        emit Withdrawn(msg.sender, amount);
    }
    
    function createAsk(uint256 maxAmount, uint256 maxFeePercentage, uint256 personalCurrencyId) external {
        require(maxAmount > 0, "Amount must be > 0");
        
        uint256 askId = askCounter++;
        asks[askId] = Ask({
            borrower: msg.sender,
            maxAmount: maxAmount,
            maxFeePercentage: maxFeePercentage,
            totalVotes: 0,
            amountDrawn: 0,
            amountRepaid: 0,
            fixedFeeAtDraw: 0,
            borrowerPersonalCurrencyId: personalCurrencyId,
            closed: false
        });
        
        emit AskCreated(askId, msg.sender, maxAmount, maxFeePercentage);
    }
    
    function vote(uint256 askId, uint256 veAmount) external {
        Ask storage ask = asks[askId];
        require(!ask.closed, "Ask closed");
        uint256 availablePower = getVotingPower(msg.sender);
        require(availablePower >= veAmount, "Insufficient voting power"); 
        
        askVotes[askId][msg.sender] += veAmount;
        ask.totalVotes += veAmount;
        
        emit Voted(askId, msg.sender, veAmount);
    }

    // Calculates the effective fee percentage dynamically based on current votes
    function getEffectiveFeePercentage(uint256 askId) public view returns (uint256) {
        Ask memory ask = asks[askId];
        if (ask.totalVotes == 0) return ask.maxFeePercentage;
        
        if (ask.totalVotes >= ask.maxAmount) {
            return (ask.maxFeePercentage * ask.maxAmount) / ask.totalVotes;
        } else {
            return ask.maxFeePercentage;
        }
    }

    // Returns locked votes for a voter using loop-free Pro-Rata dynamics:
    // Locked = VoterVotes * RemainingPrincipal / TotalVotes
    function getLockedVotes(uint256 askId, address user) public view returns (uint256) {
        Ask memory ask = asks[askId];
        if (ask.amountDrawn == 0 || ask.totalVotes == 0) return 0;

        uint256 fee = ask.fixedFeeAtDraw > 0 ? ask.fixedFeeAtDraw : getEffectiveFeePercentage(askId);
        uint256 totalDebt = ask.amountDrawn + (ask.amountDrawn * fee) / 100;
        
        if (ask.amountRepaid >= totalDebt) return 0;
        
        // Calculate remaining principal proportionally
        uint256 remainingDebt = totalDebt - ask.amountRepaid;
        uint256 remainingPrincipal = (remainingDebt * ask.amountDrawn) / totalDebt;

        return (askVotes[askId][user] * remainingPrincipal) / ask.totalVotes;
    }
    
    // Lenders can withdraw votes that are NOT currently locked by pro-rata drawn funds
    function withdrawVote(uint256 askId, uint256 veAmount) external {
        Ask storage ask = asks[askId];
        require(askVotes[askId][msg.sender] >= veAmount, "Insufficient votes cast");
        
        uint256 currentlyLocked = getLockedVotes(askId, msg.sender);
        uint256 activeUnlockedVotes = askVotes[askId][msg.sender] - currentlyLocked;
        require(veAmount <= activeUnlockedVotes, "Votes locked in active loan");
        
        askVotes[askId][msg.sender] -= veAmount;
        ask.totalVotes -= veAmount;
        
        emit VoteWithdrawn(askId, msg.sender, veAmount);
    }
    
    // Borrower draws funds, permanently freezing the effective fee rate pro-rata
    function drawFunds(uint256 askId, uint256 amount) external {
        Ask storage ask = asks[askId];
        require(msg.sender == ask.borrower, "Not borrower");
        require(!ask.closed, "Ask closed");
        
        uint256 totalCreditLine = Math.min(ask.maxAmount, ask.totalVotes);
        uint256 availableCredit = totalCreditLine - ask.amountDrawn;
        require(amount <= availableCredit, "Amount exceeds available credit");
        require(hub.balanceOf(address(this), daoCurrencyId) >= amount, "Insufficient DAO treasury");
        
        // Fix the fee permanently at the moment of first draw to prevent bait-and-switch
        if (ask.amountDrawn == 0) {
            ask.fixedFeeAtDraw = getEffectiveFeePercentage(askId);
        }
        
        ask.amountDrawn += amount;
        hub.safeTransferFrom(address(this), ask.borrower, daoCurrencyId, amount, "");
        
        emit FundsDrawn(askId, amount, ask.fixedFeeAtDraw);
    }
    
    // Continuous UBI sweep
    function sweepUBI(uint256 askId) external {
        Ask storage ask = asks[askId];
        require(!ask.closed, "Ask closed");
        
        uint256 fee = ask.fixedFeeAtDraw > 0 ? ask.fixedFeeAtDraw : getEffectiveFeePercentage(askId);
        uint256 totalDebt = ask.amountDrawn + (ask.amountDrawn * fee) / 100;
        uint256 remainingDebt = totalDebt - ask.amountRepaid;
        require(remainingDebt > 0, "No debt to repay");
        
        uint256 balance = hub.balanceOf(ask.borrower, ask.borrowerPersonalCurrencyId);
        uint256 sweepAmount = Math.min(balance, remainingDebt);
        
        if (sweepAmount > 0) {
            hub.safeTransferFrom(ask.borrower, address(this), ask.borrowerPersonalCurrencyId, sweepAmount, "");
            ask.amountRepaid += sweepAmount;
            
            if (ask.amountRepaid >= totalDebt && ask.amountDrawn == ask.maxAmount) {
                ask.closed = true;
            }
            
            emit UBISwept(askId, sweepAmount);
        }
    }
}