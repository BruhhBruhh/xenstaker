// Config

const CONFIG = {
    CONTRACT_ADDRESS: '0xffcbF84650cE02DaFE96926B37a0ac5E34932fa5',
    BASE_CHAIN_ID: 8453,
    BASE_CHAIN_ID_HEX: '0x2105',
    RPC_URL: 'https://base-mainnet.g.alchemy.com/v2/8dASJbrbZeVybFKSf3HWqgLu3uFhskOL',
    BLOCK_EXPLORER: 'https://basescan.org'
};

// Global variables
let web3;
let provider;
let account;
let contract;
let currentStake;

// DOM Elements
const connectButton = document.getElementById('connectButton');
const accountInfo = document.getElementById('accountInfo');
const networkName = document.getElementById('networkName');
const accountAddress = document.getElementById('accountAddress');
const tokenBalance = document.getElementById('tokenBalance');
const dashboardContent = document.getElementById('dashboardContent');
const currentStakeInfo = document.getElementById('currentStakeInfo');
const newStakeForm = document.getElementById('newStakeForm');
const stakeHistoryContainer = document.getElementById('stakeHistory');

// ABI - minimal contract interface
const CONTRACT_ABI = [
    // Basic token info
    {"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    
    // Stake methods
    {"inputs":[],"name":"getUserStake","outputs":[{"components":[{"internalType":"uint256","name":"term","type":"uint256"},{"internalType":"uint256","name":"maturityTs","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"apy","type":"uint256"}],"internalType":"struct XENCrypto.StakeInfo","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"term","type":"uint256"}],"name":"stake","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"getCurrentAPY","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    
    // Events
    {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"term","type":"uint256"}],"name":"Staked","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"reward","type":"uint256"}],"name":"Withdrawn","type":"event"}
];

// Connect wallet
async function connectWallet() {
    try {
        // Check if MetaMask is installed
        if (window.ethereum) {
            console.log("Connecting to wallet...");
            
            // Request account access
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            account = accounts[0];
            console.log("Connected account:", account);
            
            // Create Web3 instance
            provider = window.ethereum;
            web3 = new Web3(provider);
            
            // Check if connected to Base Chain
            const chainId = await web3.eth.getChainId();
            console.log("Connected to chain ID:", chainId);
            
            if (chainId !== CONFIG.BASE_CHAIN_ID) {
                alert("Please connect to Base Chain to use this dashboard!");
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: CONFIG.BASE_CHAIN_ID_HEX }]
                    });
                } catch (switchError) {
                    // If Base Chain is not added, prompt to add it
                    if (switchError.code === 4902) {
                        try {
                            await window.ethereum.request({
                                method: 'wallet_addEthereumChain',
                                params: [{
                                    chainId: CONFIG.BASE_CHAIN_ID_HEX,
                                    chainName: 'Base',
                                    nativeCurrency: {
                                        name: 'ETH',
                                        symbol: 'ETH',
                                        decimals: 18,
                                    },
                                    rpcUrls: ['https://mainnet.base.org'],
                                    blockExplorerUrls: [CONFIG.BLOCK_EXPLORER]
                                }]
                            });
                        } catch (addError) {
                            console.error("Failed to add Base Chain", addError);
                            alert("Please add Base Chain to your wallet manually.");
                            return;
                        }
                    } else {
                        console.error("Failed to switch to Base Chain", switchError);
                        alert("Please switch to Base Chain to use this dashboard.");
                        return;
                    }
                }
            }
            
            // Initialize contract
            contract = new web3.eth.Contract(CONTRACT_ABI, CONFIG.CONTRACT_ADDRESS);
            
            // Update UI
            networkName.textContent = 'Base';
            accountAddress.textContent = `${account.slice(0, 6)}...${account.slice(-4)}`;
            connectButton.classList.add('hidden');
            accountInfo.classList.remove('hidden');
            dashboardContent.classList.remove('hidden');
            
            // Load user data
            await loadUserData();
            
            // Setup event listeners for account and chain changes
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    // User disconnected wallet
                    resetUI();
                } else {
                    // Account changed
                    account = accounts[0];
                    accountAddress.textContent = `${account.slice(0, 6)}...${account.slice(-4)}`;
                    loadUserData();
                }
            });
            
            window.ethereum.on('chainChanged', () => {
                window.location.reload();
            });
            
        } else {
            alert("Please install MetaMask or another Web3 wallet to use this dashboard!");
        }
    } catch (error) {
        console.error("Error connecting wallet:", error);
        alert("Error connecting wallet: " + (error.message || error));
    }
}

// Reset UI
function resetUI() {
    connectButton.classList.remove('hidden');
    accountInfo.classList.add('hidden');
    dashboardContent.classList.add('hidden');
    account = null;
    provider = null;
    contract = null;
}

// Load user data
async function loadUserData() {
    try {
        console.log("Loading user data...");
        
        // Show loading indicators
        tokenBalance.textContent = "Loading...";
        currentStakeInfo.innerHTML = '<p class="text-gray-600">Loading stake info...</p>';
        newStakeForm.innerHTML = '<p class="text-gray-600">Loading...</p>';
        stakeHistoryContainer.innerHTML = '<p class="text-gray-600">Loading transaction history...</p>';
        
        // Get token balance
        const decimals = await contract.methods.decimals().call();
        const balanceWei = await contract.methods.balanceOf(account).call();
        const balanceFormatted = formatUnits(balanceWei, decimals);
        const symbol = await contract.methods.symbol().call();
        tokenBalance.textContent = parseFloat(balanceFormatted).toLocaleString() + ' ' + symbol;
        
        // Get current stake
        const userStake = await contract.methods.getUserStake().call({ from: account });
        const currentAPY = await contract.methods.getCurrentAPY().call();
        
        if (parseInt(userStake.amount) > 0) {
            currentStake = {
                term: parseInt(userStake.term),
                maturityTs: parseInt(userStake.maturityTs) * 1000, // Convert to milliseconds
                amount: formatUnits(userStake.amount, decimals),
                apy: parseInt(userStake.apy)
            };
        } else {
            currentStake = null;
        }
        
        // Update UI
        updateCurrentStakeUI(parseInt(currentAPY));
        updateNewStakeFormUI(parseInt(currentAPY));
        
        // Load stake history from blockchain
        await fetchTransactionsFromBlockExplorer();
    } catch (error) {
        console.error("Error loading user data:", error);
        alert("Error loading user data: " + (error.message || error));
    }
}

// Format units (similar to ethers.utils.formatUnits)
function formatUnits(value, decimals) {
    return (value / Math.pow(10, decimals)).toString();
}

// Parse units (similar to ethers.utils.parseUnits)
function parseUnits(value, decimals) {
    return Math.floor(parseFloat(value) * Math.pow(10, decimals)).toString();
}

// Update current stake UI
function updateCurrentStakeUI(currentAPY) {
    if (currentStake && parseFloat(currentStake.amount) > 0) {
        const now = new Date().getTime();
        const isMatured = now >= currentStake.maturityTs;
        const daysRemaining = Math.ceil((currentStake.maturityTs - now) / (1000 * 60 * 60 * 24));
        
        currentStakeInfo.innerHTML = `
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <p class="text-sm text-gray-600">Amount Staked</p>
                    <p class="font-medium">${parseFloat(currentStake.amount).toLocaleString()} cbXEN</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Term</p>
                    <p class="font-medium">${currentStake.term} days</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">APY</p>
                    <p class="font-medium">${currentStake.apy}%</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Maturity Date</p>
                    <p class="font-medium">${formatDate(currentStake.maturityTs)}</p>
                </div>
            </div>
            
            <div class="mb-4">
                <p class="text-sm text-gray-600">Expected Yield</p>
                <p class="font-medium">${calculateExpectedYield(parseFloat(currentStake.amount), currentStake.apy, currentStake.term)} cbXEN</p>
            </div>
            
            <button 
                id="withdrawButton" 
                class="w-full ${isMatured ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'} text-white font-semibold py-2 px-4 rounded"
                ${isMatured ? '' : 'disabled'}
            >
                ${isMatured ? "Withdraw Stake" : `Available in ${daysRemaining} days`}
            </button>
        `;
        
        // Add event listener for withdraw button
        if (isMatured) {
            document.getElementById('withdrawButton').addEventListener('click', withdrawStake);
        }
    } else {
        currentStakeInfo.innerHTML = `<p class="text-gray-600">You have no active stakes</p>`;
    }
}

// Update new stake form UI
function updateNewStakeFormUI(currentAPY) {
    if (!currentStake || parseFloat(currentStake.amount) === 0) {
        newStakeForm.innerHTML = `
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Amount (cbXEN)</label>
                <input 
                    type="number" 
                    id="stakeAmount" 
                    placeholder="Enter amount to stake" 
                    class="w-full p-2 border border-gray-300 rounded" 
                />
            </div>
            
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Term (days)</label>
                <input 
                    type="number" 
                    id="stakeTerm" 
                    value="1" 
                    min="1" 
                    class="w-full p-2 border border-gray-300 rounded" 
                />
            </div>
            
            <div id="stakePreview" class="mb-4 p-3 bg-gray-100 rounded hidden">
                <p class="text-sm text-gray-600">Current APY: <span id="previewAPY">${currentAPY}%</span></p>
                <p class="text-sm text-gray-600">Expected Yield: <span id="previewYield">0</span> cbXEN</p>
                <p class="text-sm text-gray-600">Maturity Date: <span id="previewMaturity">${formatDate(new Date().getTime() + 24 * 60 * 60 * 1000)}</span></p>
            </div>
            
            <button 
                id="createStakeButton" 
                class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
            >
                Create Stake
            </button>
        `;
        
        // Add event listeners
        const stakeAmountInput = document.getElementById('stakeAmount');
        const stakeTermInput = document.getElementById('stakeTerm');
        const stakePreview = document.getElementById('stakePreview');
        const previewYield = document.getElementById('previewYield');
        const previewMaturity = document.getElementById('previewMaturity');
        
        function updatePreview() {
            const amount = parseFloat(stakeAmountInput.value) || 0;
            const term = parseInt(stakeTermInput.value) || 1;
            
            if (amount > 0 && term > 0) {
                previewYield.textContent = calculateExpectedYield(amount, currentAPY, term);
                previewMaturity.textContent = formatDate(new Date().getTime() + term * 24 * 60 * 60 * 1000);
                stakePreview.classList.remove('hidden');
            } else {
                stakePreview.classList.add('hidden');
            }
        }
        
        stakeAmountInput.addEventListener('input', updatePreview);
        stakeTermInput.addEventListener('input', updatePreview);
        
        document.getElementById('createStakeButton').addEventListener('click', createStake);
    } else {
        newStakeForm.innerHTML = `<p class="text-gray-600">You already have an active stake. You can create a new stake after withdrawing your current one.</p>`;
    }
}

// Fetch transactions directly from Basescan via direct link
async function fetchTransactionsFromBlockExplorer() {
    // Update UI to show we're working on it
    stakeHistoryContainer.innerHTML = `
        <div class="mb-4">
            <p class="text-gray-600">We can't directly access your full transaction history from the blockchain without an API key.</p>
            <p class="text-gray-600 mt-2">View your full stake history on Basescan:</p>
            <div class="mt-3">
                <a href="https://basescan.org/address/${account}#tokentxns" target="_blank" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded mr-2">
                    View Token Transfers
                </a>
                <a href="https://basescan.org/advanced-filter?fadd=${account}&tadd=${account}&mtd=0x3ccfd60b%7eWithdraw,0x3a4b66f1%7eStake" target="_blank" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded">
                    View Stake/Withdraw History
                </a>
            </div>
        </div>
    `;
    
    // Now try to fetch recent transactions (may not work due to CORS)
    try {
        // Using web3 to get past events
        const latestBlock = await web3.eth.getBlockNumber();
        const fromBlock = Math.max(0, latestBlock - 100000); // Look back ~500k blocks
        
        console.log(`Checking for events from block ${fromBlock} to ${latestBlock}`);
        
        // Array to store history items
        const historyItems = [];
        
        // Try to get events filtered by our address
        try {
            const stakeEvents = await contract.getPastEvents('Staked', {
                filter: { user: account },
                fromBlock: fromBlock,
                toBlock: 'latest'
            });
            
            const withdrawEvents = await contract.getPastEvents('Withdrawn', {
                filter: { user: account },
                fromBlock: fromBlock,
                toBlock: 'latest'
            });
            
            console.log("Found stake events:", stakeEvents.length);
            console.log("Found withdraw events:", withdrawEvents.length);
            
            // Get decimals for formatting
            const decimals = await contract.methods.decimals().call();
            
            // Process stake events
            for (const event of stakeEvents) {
                historyItems.push({
                    type: 'stake',
                    blockNumber: event.blockNumber,
                    timestamp: (await web3.eth.getBlock(event.blockNumber)).timestamp * 1000,
                    amount: formatUnits(event.returnValues.amount, decimals),
                    term: parseInt(event.returnValues.term),
                    txHash: event.transactionHash
                });
            }
            
            // Process withdraw events
            for (const event of withdrawEvents) {
                historyItems.push({
                    type: 'withdraw',
                    blockNumber: event.blockNumber,
                    timestamp: (await web3.eth.getBlock(event.blockNumber)).timestamp * 1000,
                    amount: formatUnits(event.returnValues.amount, decimals),
                    reward: formatUnits(event.returnValues.reward, decimals),
                    txHash: event.transactionHash
                });
            }
            
            // If we found events, display them
            if (historyItems.length > 0) {
                // Sort by block number (descending)
                historyItems.sort((a, b) => b.blockNumber - a.blockNumber);
                displayTransactionHistory(historyItems);
                return;
            }
        } catch (eventError) {
            console.error("Error fetching events:", eventError);
        }
        
        // If we couldn't get events, try to scan recent transactions to this contract
        const transactions = await scanRecentTransactions();
        
        if (transactions.length > 0) {
            displayTransactionHistory(transactions);
        } else {
            // No transactions found, keep the links to Basescan
            console.log("No transactions found via direct scanning");
        }
    } catch (error) {
        console.error("Error fetching transactions:", error);
        // Keep the links to Basescan in the UI
    }
}

// Scan recent transactions
async function scanRecentTransactions() {
    try {
        // Get latest blocks
        const latestBlock = await web3.eth.getBlockNumber();
        
        // For efficiency, we'll only scan the last 10 blocks
        const startBlock = Math.max(0, latestBlock - 10);
        const transactionsToCheck = [];
        
        console.log(`Scanning blocks ${startBlock} to ${latestBlock}`);
        
        // Get blocks
        for (let i = startBlock; i <= latestBlock; i++) {
            const block = await web3.eth.getBlock(i, true);
            if (block && block.transactions) {
                // Filter transactions involving our contract and address
                const relevantTxs = block.transactions.filter(tx => 
                    (tx.to && tx.to.toLowerCase() === CONFIG.CONTRACT_ADDRESS.toLowerCase()) && 
                    (tx.from && tx.from.toLowerCase() === account.toLowerCase())
                );
                
                transactionsToCheck.push(...relevantTxs);
            }
        }
        
        console.log(`Found ${transactionsToCheck.length} relevant transactions`);
        
        // Process transactions
        const historyItems = [];
        const decimals = await contract.methods.decimals().call();
        
        for (const tx of transactionsToCheck) {
            // Get function signature (first 10 characters of input)
            const methodId = tx.input.substring(0, 10);
            
            // Method IDs for stake and withdraw functions
            const stakeMethodId = "0x3a4b66f1"; // stake(uint256,uint256)
            const withdrawMethodId = "0x3ccfd60b"; // withdraw()
            
            // Get block for timestamp
            const block = await web3.eth.getBlock(tx.blockNumber);
            
            if (methodId === stakeMethodId) {
                // Stake transaction
                try {
                    // Decode parameters
                    const params = '0x' + tx.input.substring(10);
                    const decodedParams = web3.eth.abi.decodeParameters(['uint256', 'uint256'], params);
                    
                    historyItems.push({
                        type: 'stake',
                        blockNumber: tx.blockNumber,
                        timestamp: block.timestamp * 1000,
                        amount: formatUnits(decodedParams[0], decimals),
                        term: parseInt(decodedParams[1]),
                        txHash: tx.hash
                    });
                } catch (error) {
                    console.error("Error decoding stake parameters:", error);
                }
            } else if (methodId === withdrawMethodId) {
                // Withdraw transaction
                historyItems.push({
                    type: 'withdraw',
                    blockNumber: tx.blockNumber,
                    timestamp: block.timestamp * 1000,
                    amount: "Check on Basescan", // We can't get this from the transaction data directly
                    reward: "Check on Basescan",
                    txHash: tx.hash
                });
            }
        }
        
        return historyItems;
    } catch (error) {
        console.error("Error scanning recent transactions:", error);
        return [];
    }
}

// Display transaction history
function displayTransactionHistory(transactions) {
    if (transactions.length === 0) {
        stakeHistoryContainer.innerHTML = `
            <p class="text-gray-600">No transactions found. View your transaction history on Basescan:</p>
            <div class="mt-3">
                <a href="https://basescan.org/address/${account}#tokentxns" target="_blank" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded mr-2">
                    View Token Transfers
                </a>
                <a href="https://basescan.org/advanced-filter?fadd=${account}&tadd=${account}&mtd=0x3ccfd60b%7eWithdraw,0x3a4b66f1%7eStake" target="_blank" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded">
                    View Stake/Withdraw History
                </a>
            </div>
        `;
        return;
    }
    
    // Build the table HTML
    let tableHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full">
                <thead>
                    <tr class="bg-gray-100">
                        <th class="p-2 text-left">Date</th>
                        <th class="p-2 text-left">Type</th>
                        <th class="p-2 text-left">Amount</th>
                        <th class="p-2 text-left">Term</th>
                        <th class="p-2 text-left">Reward</th>
                        <th class="p-2 text-left">Transaction</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    for (const tx of transactions) {
        const date = formatDate(tx.timestamp);
        const typeLabel = tx.type === 'stake' ? 'Stake' : 'Withdraw';
        const typeClass = tx.type === 'stake' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
        
        tableHTML += `
            <tr class="border-b">
                <td class="p-2">${date}</td>
                <td class="p-2">
                    <span class="inline-block px-2 py-1 text-xs font-semibold rounded ${typeClass}">
                        ${typeLabel}
                    </span>
                </td>
                <td class="p-2">${typeof tx.amount === 'string' ? tx.amount : parseFloat(tx.amount).toLocaleString()} cbXEN</td>
                <td class="p-2">${tx.type === 'stake' ? tx.term + ' days' : '-'}</td>
                <td class="p-2">${tx.type === 'withdraw' && tx.reward ? (typeof tx.reward === 'string' ? tx.reward : parseFloat(tx.reward).toLocaleString()) + ' cbXEN' : '-'}</td>
                <td class="p-2">
                    <a href="https://basescan.org/tx/${tx.txHash}" target="_blank" class="text-blue-600 hover:underline">
                        ${tx.txHash.substring(0, 6)}...${tx.txHash.substring(62)}
                    </a>
                </td>
            </tr>
        `;
    }
    
    tableHTML += `
                </tbody>
            </table>
        </div>
        
        <div class="mt-4">
            <p class="text-gray-600">View complete history on Basescan:</p>
            <div class="mt-2">
                <a href="https://basescan.org/advanced-filter?fadd=${account}&tadd=${account}&mtd=0x3ccfd60b%7eWithdraw,0x3a4b66f1%7eStake" target="_blank" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded">
                    View Full History
                </a>
            </div>
        </div>
    `;
    
    stakeHistoryContainer.innerHTML = tableHTML;
}

// Create a new stake
async function createStake() {
    try {
        const stakeAmountInput = document.getElementById('stakeAmount');
        const stakeTermInput = document.getElementById('stakeTerm');
        
        const amount = stakeAmountInput.value;
        const term = parseInt(stakeTermInput.value);
        
        if (!amount || parseFloat(amount) <= 0) {
            alert("Please enter a valid amount");
            return;
        }
        
        if (!term || term < 1) {
            alert("Please enter a valid term (minimum 1 day)");
            return;
        }
        
        // Disable button to prevent double-clicks
        const button = document.getElementById('createStakeButton');
        button.disabled = true;
        button.textContent = "Processing...";
        
        // Convert amount to wei
        const decimals = await contract.methods.decimals().call();
        const amountWei = parseUnits(amount, decimals);
        
        // Send transaction
        await contract.methods.stake(amountWei, term).send({ from: account });
        
        alert("Stake created successfully!");
        
        // Reload user data
        await loadUserData();
    } catch (error) {
        console.error("Error creating stake:", error);
        alert("Error creating stake: " + (error.message || error));
        
        const button = document.getElementById('createStakeButton');
        if (button) {
            button.disabled = false;
            button.textContent = "Create Stake";
        }
    }
}

// Withdraw stake
async function withdrawStake() {
    try {
        // Disable button to prevent double-clicks
        const button = document.getElementById('withdrawButton');
        button.disabled = true;
        button.textContent = "Processing...";
        
        // Send transaction
        await contract.methods.withdraw().send({ from: account });
        
        alert("Stake withdrawn successfully!");
        
        // Reload user data
        await loadUserData();
    } catch (error) {
        console.error("Error withdrawing stake:", error);
        alert("Error withdrawing stake: " + (error.message || error));
        
        const button = document.getElementById('withdrawButton');
        if (button) {
            button.disabled = false;
            button.textContent = "Withdraw Stake";
        }
    }
}

// Calculate expected yield
function calculateExpectedYield(amount, apy, term) {
    const dailyRate = apy / 365 / 100;
    const dailyYield = amount * dailyRate;
    return (dailyYield * term).toFixed(2);
}

// Format date
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Add connect button event listener
    connectButton.addEventListener('click', connectWallet);
    
    // Check if wallet is already connected (e.g., after page refresh)
    if (window.ethereum && window.ethereum.selectedAddress) {
        connectWallet();
    }
});
