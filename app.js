// Config
const CONFIG = {
    CONTRACT_ADDRESS: '0xffcbF84650cE02DaFE96926B37a0ac5E34932fa5',
    BASE_CHAIN_ID: 8453,
    BASE_CHAIN_ID_HEX: '0x2105',
    RPC_URL: 'https://base-mainnet.g.alchemy.com/v2/8dASJbrbZeVybFKSf3HWqgLu3uFhskOL',
    BLOCK_EXPLORER: 'https://basescan.org',
    CHAIN_CONFIGS: {
        ethereum: {
            chainId: 1,
            chainIdHex: '0x1',
            name: 'Ethereum',
            rpcUrl: 'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
            blockExplorer: 'https://etherscan.io',
            contractAddress: '0xDd68332Fe8099c0CF3619cB3Bb0D8159EF1eCc93' // Example, replace with actual address
        },
        base: {
            chainId: 8453,
            chainIdHex: '0x2105',
            name: 'Base',
            rpcUrl: 'https://base-mainnet.g.alchemy.com/v2/8dASJbrbZeVybFKSf3HWqgLu3uFhskOL',
            blockExplorer: 'https://basescan.org',
            contractAddress: '0xffcbF84650cE02DaFE96926B37a0ac5E34932fa5'
        },
        optimism: {
            chainId: 10,
            chainIdHex: '0xA',
            name: 'Optimism',
            rpcUrl: 'https://mainnet.optimism.io',
            blockExplorer: 'https://optimistic.etherscan.io',
            contractAddress: '' // Replace with actual address
        },
        avalanche: {
            chainId: 43114,
            chainIdHex: '0xA86A',
            name: 'Avalanche',
            rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
            blockExplorer: 'https://snowtrace.io',
            contractAddress: '' // Replace with actual address
        },
        polygon: {
            chainId: 137,
            chainIdHex: '0x89',
            name: 'Polygon',
            rpcUrl: 'https://polygon-rpc.com',
            blockExplorer: 'https://polygonscan.com',
            contractAddress: '' // Replace with actual address
        },
        bsc: {
            chainId: 56,
            chainIdHex: '0x38',
            name: 'BSC',
            rpcUrl: 'https://bsc-dataseed.binance.org',
            blockExplorer: 'https://bscscan.com',
            contractAddress: '' // Replace with actual address
        }
    }
};

// Global variables
let web3;
let provider;
let account;
let contract;
let currentStake;
let selectedChain = 'base'; // Default chain

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
const chainOptions = document.querySelectorAll('.chain-option');

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
            
            // Get current chain config
            const chainConfig = CONFIG.CHAIN_CONFIGS[selectedChain];
            
            // Check if connected to the correct chain
            const chainId = await web3.eth.getChainId();
            console.log("Connected to chain ID:", chainId);
            
            if (chainId !== chainConfig.chainId) {
                const confirmSwitch = confirm(`You need to connect to ${chainConfig.name} network to use this dashboard. Would you like to switch now?`);
                
                if (confirmSwitch) {
                    try {
                        await window.ethereum.request({
                            method: 'wallet_switchEthereumChain',
                            params: [{ chainId: chainConfig.chainIdHex }]
                        });
                    } catch (switchError) {
                        // If chain is not added, prompt to add it
                        if (switchError.code === 4902) {
                            try {
                                await window.ethereum.request({
                                    method: 'wallet_addEthereumChain',
                                    params: [{
                                        chainId: chainConfig.chainIdHex,
                                        chainName: chainConfig.name,
                                        nativeCurrency: {
                                            name: 'ETH',
                                            symbol: 'ETH',
                                            decimals: 18,
                                        },
                                        rpcUrls: [chainConfig.rpcUrl],
                                        blockExplorerUrls: [chainConfig.blockExplorer]
                                    }]
                                });
                            } catch (addError) {
                                console.error(`Failed to add ${chainConfig.name} Chain`, addError);
                                alert(`Please add ${chainConfig.name} Chain to your wallet manually.`);
                                return;
                            }
                        } else {
                            console.error(`Failed to switch to ${chainConfig.name} Chain`, switchError);
                            alert(`Please switch to ${chainConfig.name} Chain to use this dashboard.`);
                            return;
                        }
                    }
                } else {
                    alert(`You need to be on ${chainConfig.name} network to use this dashboard.`);
