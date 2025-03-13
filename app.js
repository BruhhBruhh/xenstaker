// Config
const CONFIG = {
    CONTRACT_ADDRESS: '0xffcbF84650cE02DaFE96926B37a0ac5E34932fa5',
    BASE_CHAIN_ID: 8453,
    BASE_CHAIN_ID_HEX: '0x2105',
    RPC_URL: 'https://base-mainnet.g.alchemy.com/v2/8dASJbrbZeVybFKSf3HWqgLu3uFhskOL',
    NETWORK_METADATA: {
        chainId: '0x2105',
        chainName: 'Base',
        nativeCurrency: {
            name: 'ETH',
            symbol: 'ETH',
            decimals: 18,
        },
        rpcUrls: ['https://mainnet.base.org'],
        blockExplorerUrls: ['https://basescan.org/'],
    },
    // Simplified ABI with essential functions
    CONTRACT_ABI: [
        {
            "inputs": [],
            "name": "getUserStake",
            "outputs": [{"components": [{"internalType": "uint256", "name": "term", "type": "uint256"},{"internalType": "uint256", "name": "maturityTs", "type": "uint256"},{"internalType": "uint256", "name": "amount", "type": "uint256"},{"internalType": "uint256", "name": "apy", "type": "uint256"}], "internalType": "struct XENCrypto.StakeInfo", "name": "", "type": "tuple"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
            "name": "balanceOf",
            "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [{"internalType": "uint256", "name": "amount", "type": "uint256"},{"internalType": "uint256", "name": "term", "type": "uint256"}],
            "name": "stake",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "withdraw",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "getCurrentAPY",
            "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "decimals",
            "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
            "stateMutability": "view",
            "type": "function"
        }
    ]
};

// Global variables
let web3;
let web3Modal;
let provider;
let account;
let contract;
let currentStake;
let stakeHistory = [];

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

// Initialize Web3Modal
function initWeb3Modal() {
    const providerOptions = {
        walletconnect: {
            package: WalletConnectProvider.default,
            options: {
                rpc: {
                    [CONFIG.BASE_CHAIN_ID]: CONFIG.RPC_URL
                },
                chainId: CONFIG.BASE_CHAIN_ID
            }
        }
    };

    web3Modal = new Web3Modal.default({
        cacheProvider: true,
        providerOptions,
        disableInjectedProvider: false,
        theme: "dark"
    });
}

// Connect wallet
async function connectWallet() {
    try {
        provider = await web3Modal.connect();
        
        web3 = new Web3(provider);
        const accounts = await web3.eth.getAccounts();
        account = accounts[0];
        
        // Check if connected to Base Chain
        const chainId = await web3.eth.getChainId();
        if (chainId !== CONFIG.BASE_CHAIN_ID) {
            alert("Please connect to Base Chain to use this dashboard!");
            try {
                await web3.currentProvider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: CONFIG.BASE_CHAIN_ID_HEX }]
                });
            } catch (switchError) {
                // If Base Chain is not added, prompt to add it
                if (switchError.code === 4902) {
                    try {
                        await web3.currentProvider.request({
                            method: 'wallet_addEthereumChain',
                            params: [CONFIG.NETWORK_METADATA]
                        });
                    } catch (addError) {
                        console.error("Failed to add Base Chain", addError);
                    }
                }
                console.error("Failed to switch to Base Chain", switchError);
                return;
            }
        }
        
        // Initialize contract
        contract = new web3.eth.Contract(CONFIG.CONTRACT_ABI, CONFIG.CONTRACT_ADDRESS);
        
        // Update UI
        networkName.textContent = 'Base';
        accountAddress.textContent = `${account.slice(0, 6)}...${account.slice(-4)}`;
        connectButton.classList.add('hidden');
        accountInfo.classList.remove('hidden');
        dashboardContent.classList.remove('hidden');
        
        // Load user data
        await loadUserData();
        
        // Subscribe to events
        provider.on("accountsChanged", (accounts) => {
            if (accounts.length > 0) {
                account = accounts[0];
                accountAddress.textContent = `${account.slice(0, 6)}...${account.slice(-4)}`;
                loadUserData();
            } else {
                resetUI();
            }
        });
        
        provider.on("chainChanged", (chainId) => {
            window.location.reload();
        });
        
        provider.on("disconnect", () => {
            resetUI();
        });
        
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
        // Get token balance
        const decimals = await contract.methods.decimals().call();
        const balanceWei = await contract.methods.balanceOf(account).call();
        const balanceFormatted = formatUnits(balanceWei, decimals);
        tokenBalance.textContent = parseFloat(balanceFormatted).toLocaleString() + ' cbXEN';
        
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
        loadStakeHistory();
    } catch (error) {
        console.error("Error loading user data:", error);
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

// Load stake history
function loadStakeHistory() {
    // In a real app, this would fetch from a database or blockchain events
    // For demo purposes, we'll use some sample data or local storage
    if (stakeHistory.length === 0) {
        const storedHistory = localStorage.getItem('xenStakeHistory_' + account);
        if (storedHistory) {
            stakeHistory = JSON.parse(storedHistory);
        } else {
            generateDemoStakeHistory();
        }
    }
    
    if (stakeHistory.length > 0) {
        let tableHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full">
                    <thead>
                        <tr class="bg-gray-100">
                            <th class="p-2 text-left">Start Date</th>
                            <th class="p-2 text-left">End Date</th>
                            <th class="p-2 text-left">Amount</th>
                            <th class="p-2 text-left">Term</th>
                            <th class="p-2 text-left">APY</th>
                            <th class="p-2 text-left">Reward</th>
                            <th class="p-2 text-left">Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        stakeHistory.forEach(stake => {
            tableHTML += `
                <tr class="border-b">
                    <td class="p-2">${stake.startDate}</td>
                    <td class="p-2">${stake.endDate}</td>
                    <td class="p-2">${stake.amount}</td>
                    <td class="p-2">${stake.term} days</td>
                    <td class="p-2">${stake.apy}%</td>
                    <td class="p-2">${stake.reward}</td>
                    <td class="p-2">
                        <span class="inline-block px-2 py-1 text-xs font-semibold rounded ${stake.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                            ${stake.status}
                        </span>
                    </td>
                </tr>
            `;
        });
        
        tableHTML += `
                    </tbody>
                </table>
            </div>
        `;
        
        stakeHistoryContainer.innerHTML = tableHTML;
    } else {
        stakeHistoryContainer.innerHTML = `<p class="text-gray-600">No stake history available</p>`;
    }
}

// Generate demo stake history
function generateDemoStakeHistory() {
    const now = new Date().getTime();
    const day = 24 * 60 * 60 * 1000;
    
    stakeHistory = [
        {
            startDate: formatDate(now - 90 * day),
            endDate: formatDate(now - 60 * day),
            amount: "100,000,000",
            term: 30,
            apy: 14,
            reward: "1,150,684.93",
            status: "Completed"
        },
        {
            startDate: formatDate(now - 59 * day),
            endDate: formatDate(now - 30 * day),
            amount: "200,000,000",
            term: 29,
            apy: 14,
            reward: "2,230,136.99",
            status: "Completed"
        }
    ];
    
    // Save to local storage
    localStorage.setItem('xenStakeHistory_' + account, JSON.stringify(stakeHistory));
}

// Create a new stake
async function createStake() {
    try {
        const stakeAmountInput = document.getElementById('stakeAmount');
        const stakeTermInput = document.getElementById('stakeTerm');
        
        const amount = stakeAmountInput.value;
        const term = parseInt(stakeTermInput.value);
        
        if (!amount || amount <= 0) {
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
        
        // Reset form
        button.disabled = false;
        button.textContent = "Create Stake";
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
        
        // Add to history
        stakeHistory.unshift({
            startDate: formatDate(new Date().getTime() - (currentStake.term * 24 * 60 * 60 * 1000)),
            endDate: formatDate(new Date().getTime()),
            amount: parseFloat(currentStake.amount).toLocaleString(),
            term: currentStake.term,
            apy: currentStake.apy,
            reward: calculateExpectedYield(parseFloat(currentStake.amount), currentStake.apy, currentStake.term),
            status: "Completed"
        });
        
        // Save to local storage
        localStorage.setItem('xenStakeHistory_' + account, JSON.stringify(stakeHistory));
        
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
    return new Date(timestamp).toLocaleDateString();
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initWeb3Modal();
    connectButton.addEventListener('click', connectWallet);
    
    // Auto connect if provider is cached
    if (web3Modal.cachedProvider) {
        connectWallet();
    }
});
