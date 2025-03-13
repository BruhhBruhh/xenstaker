// Wait for ethers to be available
function waitForEthers() {
  if (typeof ethers !== 'undefined') {
    // Initialize your app
    init();
  } else {
    // Check again in 100ms
    setTimeout(waitForEthers, 100);
  }
}

// Start checking
waitForEthers();

// Then place your init function and other code after this

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
    CONTRACT_ABI: [
        "function getUserStake() external view returns (tuple(uint256 term, uint256 maturityTs, uint256 amount, uint256 apy))",
        "function balanceOf(address account) view returns (uint256)",
        "function stake(uint256 amount, uint256 term) external",
        "function withdraw() external",
        "function getCurrentAPY() external view returns (uint256)",
        "function symbol() external view returns (string)",
        "function decimals() external view returns (uint8)",
        "function name() external view returns (string)",
        "function getUserMint() external view returns (tuple(address user, uint256 term, uint256 maturityTs, uint256 rank, uint256 amplifier, uint256 eaaRate))",
        "function totalXenStaked() external view returns (uint256)",
        "function globalRank() external view returns (uint256)"
    ]
};

// Global variables
let provider, signer, contract, account, currentStake, stakeHistory = [];

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

// Initialize the app
async function init() {
    connectButton.addEventListener('click', connectWallet);
    
    // Check if already connected
    if (window.ethereum && window.ethereum.selectedAddress) {
        connectWallet();
    }
    
    // Listen for account changes
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length > 0) {
                connectWallet();
            } else {
                resetUI();
            }
        });
        
        window.ethereum.on('chainChanged', () => {
            window.location.reload();
        });
    }
}

// Connect wallet
async function connectWallet() {
    try {
        if (window.ethereum) {
            provider = new ethers.providers.Web3Provider(window.ethereum);
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            signer = provider.getSigner();
            account = await signer.getAddress();
            
            // Check if we're on Base Chain
            const network = await provider.getNetwork();
            if (network.chainId !== CONFIG.BASE_CHAIN_ID) {
                await switchToBaseChain();
            }
            
            networkName.textContent = 'Base';
            accountAddress.textContent = `${account.slice(0, 6)}...${account.slice(-4)}`;
            
            // Initialize contract
            contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONFIG.CONTRACT_ABI, signer);
            
            // Load user data
            await loadUserData();
            
            // Update UI
            connectButton.classList.add('hidden');
            accountInfo.classList.remove('hidden');
            dashboardContent.classList.remove('hidden');
        } else {
            alert("Please install MetaMask or another Web3 wallet!");
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
}

// Switch to Base Chain
async function switchToBaseChain() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: CONFIG.BASE_CHAIN_ID_HEX }],
        });
    } catch (error) {
        // If Base Chain is not added to MetaMask, prompt to add it
        if (error.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [CONFIG.NETWORK_METADATA],
                });
            } catch (addError) {
                console.error("Failed to add Base Chain", addError);
                alert("Please add Base Chain to your wallet manually.");
            }
        } else {
            console.error("Failed to switch to Base Chain", error);
            alert("Please switch to Base Chain to use this dashboard.");
        }
    }
}

// Load user data
async function loadUserData() {
    try {
        // Get token balance
        const decimals = await contract.decimals();
        const balanceWei = await contract.balanceOf(account);
        const balanceFormatted = ethers.utils.formatUnits(balanceWei, decimals);
        tokenBalance.textContent = parseFloat(balanceFormatted).toLocaleString() + ' cbXEN';
        
        // Get current stake
        const userStake = await contract.getUserStake();
        const currentAPY = await contract.getCurrentAPY();
        
        if (userStake.amount.gt(0)) {
            currentStake = {
                term: userStake.term.toNumber(),
                maturityTs: userStake.maturityTs.toNumber() * 1000, // Convert to milliseconds
                amount: ethers.utils.formatUnits(userStake.amount, decimals),
                apy: userStake.apy.toNumber()
            };
        } else {
            currentStake = null;
        }
        
        // Update UI
        updateCurrentStakeUI(currentAPY.toNumber());
        updateNewStakeFormUI(currentAPY.toNumber());
        loadStakeHistory();
    } catch (error) {
        console.error("Error loading user data:", error);
    }
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
    // For demo purposes, we'll use some sample data
    if (stakeHistory.length === 0) {
        generateDemoStakeHistory();
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
        const decimals = await contract.decimals();
        const amountWei = ethers.utils.parseUnits(amount, decimals);
        
        // Send transaction
        const tx = await contract.stake(amountWei, term);
        await tx.wait();
        
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
        const tx = await contract.withdraw();
        await tx.wait();
        
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
window.addEventListener('DOMContentLoaded', init);
