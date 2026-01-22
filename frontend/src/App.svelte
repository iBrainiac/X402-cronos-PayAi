<script>
  import { onMount } from 'svelte';
  import { ethers } from 'ethers';
  import { CONFIG } from './config/app.js';
  import { generatePaymentHeader } from './lib/x402Payment.js';
  import AgentInterface from './components/AgentInterface.svelte';
  import LandingPage from './components/LandingPage.svelte';

  let showLanding = true;
  let wallet = null;
  let account = null;
  let currentChainId = null;
  let status = 'idle'; // idle, connecting, connected, requesting, payment_required, processing, success, error
  let error = null;
  let result = null;
  let paymentInfo = null;

  function handleGetStarted() {
    showLanding = false;
  }

  // Check if wallet is already connected and verify network
  onMount(async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          wallet = new ethers.BrowserProvider(window.ethereum);
          const network = await wallet.getNetwork();
          currentChainId = Number(network.chainId);
          
          // Only set as connected if on correct network
          if (currentChainId === CONFIG.CHAIN_ID) {
            account = accounts[0];
            status = 'connected';
          }
        }
      } catch (err) {
        // Silently fail - wallet not truly connected
        console.error('Wallet connection check failed:', err);
      }

      // Listen for network changes
      window.ethereum.on('chainChanged', async (chainId) => {
        currentChainId = parseInt(chainId, 16);
        if (wallet) {
          const network = await wallet.getNetwork();
          currentChainId = Number(network.chainId);
          
          if (currentChainId === CONFIG.CHAIN_ID && account) {
            status = 'connected';
          } else {
            status = 'idle';
            account = null;
          }
        }
      });

      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          account = null;
          status = 'idle';
        } else if (currentChainId === CONFIG.CHAIN_ID) {
          account = accounts[0];
          status = 'connected';
        }
      });
    }
  });

  async function switchToCronosNetwork() {
    if (!window.ethereum) {
      error = 'Please install MetaMask or a compatible wallet';
      return;
    }

    try {
      status = 'connecting';
      error = null;

      // Try to switch to Cronos Testnet
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: CONFIG.NETWORK.chainId }],
        });
      } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          // Add the network
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [CONFIG.NETWORK],
          });
        } else {
          throw switchError;
        }
      }

      // Refresh wallet connection
      wallet = new ethers.BrowserProvider(window.ethereum);
      const network = await wallet.getNetwork();
      currentChainId = Number(network.chainId);

      if (currentChainId === CONFIG.CHAIN_ID) {
        // Check if account is already connected
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          account = accounts[0];
          status = 'connected';
        } else {
          status = 'idle';
        }
      }
    } catch (err) {
      error = err.message || 'Failed to switch network';
      status = 'error';
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      error = 'Please install MetaMask or a compatible wallet';
      return;
    }

    try {
      status = 'connecting';
      error = null;
      
      wallet = new ethers.BrowserProvider(window.ethereum);
      const accounts = await wallet.send('eth_requestAccounts', []);
      account = accounts[0];
      
      // Check network
      const network = await wallet.getNetwork();
      currentChainId = Number(network.chainId);
      
      if (currentChainId !== CONFIG.CHAIN_ID) {
        // Automatically prompt to switch network
        await switchToCronosNetwork();
        return;
      }
      
      status = 'connected';
    } catch (err) {
      error = err.message || 'Failed to connect wallet';
      status = 'idle';
      account = null;
      wallet = null;
    }
  }

  async function requestAccess() {
    if (!wallet || !account) {
      error = 'Please connect your wallet first';
      return;
    }

    try {
      status = 'requesting';
      error = null;
      result = null;

      // First request - get payment requirements
      const response = await fetch(`${CONFIG.API_URL}/api/agent/run`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 402) {
        // Payment required - generate signature
        const data = await response.json();
        paymentInfo = data;
        
        try {
          status = 'processing';
          
          // Get signer
          const signer = await wallet.getSigner();
          
          // Generate EIP-3009 payment header
          const paymentHeader = await generatePaymentHeader(signer, data.paymentRequirements);
          
          // Retry request with payment header
          const paidResponse = await fetch(`${CONFIG.API_URL}/api/agent/run`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-PAYMENT': paymentHeader
            }
          });

          if (paidResponse.ok) {
            result = await paidResponse.json();
            console.log('✅ Payment successful, result:', result);
            console.log('📊 Result structure:', {
              hasData: !!result.data,
              hasPayment: !!result.payment,
              status: 'success'
            });
            status = 'success';
          } else {
            const errorData = await paidResponse.json();
            console.error('❌ Payment failed:', errorData);
            throw new Error(errorData.invalidReason || errorData.error || 'Payment failed');
          }
        } catch (paymentErr) {
          error = paymentErr.message || 'Payment processing failed';
          status = 'error';
        }
      } else if (response.ok) {
        // Success (shouldn't happen on first request, but handle it)
        result = await response.json();
        status = 'success';
      } else {
        throw new Error(`Request failed: ${response.statusText}`);
      }
    } catch (err) {
      error = err.message || 'Failed to request access';
      status = 'error';
    }
  }

  function formatAddress(addr) {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  function getStatusMessage() {
    switch (status) {
      case 'idle': return 'Ready';
      case 'connecting': return 'Connecting wallet...';
      case 'connected': return 'Wallet connected';
      case 'requesting': return 'Requesting access...';
      case 'payment_required': return 'Payment required';
      case 'processing': return 'Processing payment...';
      case 'success': return 'Access granted!';
      case 'error': return 'Error occurred';
      default: return '';
    }
  }
</script>

{#if showLanding}
  <LandingPage on:get-started={handleGetStarted} />
{:else}
<div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
  <div class="w-full {result && status === 'success' ? 'max-w-4xl' : 'max-w-md'}" style="min-height: {result && status === 'success' ? '600px' : 'auto'}">
    <!-- Header -->
    <div class="text-center mb-8">
      <h1 class="text-4xl font-bold text-white mb-2">🚀 Cronos X402 Gateway</h1>
      <p class="text-slate-300">Pay-per-request AI agent access</p>
    </div>

    <!-- Main Card -->
    <div class="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
      <!-- Wallet Status -->
      <div class="mb-6">
        {#if account && status === 'connected'}
          <div class="space-y-3">
            <div class="flex items-center justify-between bg-green-500/20 border border-green-500/50 rounded-lg p-3">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 bg-green-400 rounded-full"></div>
                <span class="text-green-300 text-sm font-medium">Connected</span>
              </div>
              <span class="text-green-200 text-xs font-mono">{formatAddress(account)}</span>
            </div>
            <div class="bg-blue-500/20 border border-blue-500/50 rounded-lg p-2 text-center">
              <span class="text-blue-200 text-xs">Cronos Testnet</span>
            </div>
          </div>
        {:else if currentChainId && currentChainId !== CONFIG.CHAIN_ID}
          <!-- Wrong Network Warning -->
          <div class="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-3">
            <p class="text-yellow-200 text-sm mb-3">Please switch to Cronos Testnet to continue</p>
            <button
              on:click={switchToCronosNetwork}
              disabled={status === 'connecting'}
              class="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 text-sm"
            >
              {#if status === 'connecting'}
                <span class="flex items-center justify-center gap-2">
                  <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Switching...
                </span>
              {:else}
                Switch to Cronos Testnet
              {/if}
            </button>
          </div>
        {:else}
          <button
            on:click={connectWallet}
            disabled={status === 'connecting'}
            class="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
          >
            {#if status === 'connecting'}
              <span class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </span>
            {:else}
              Connect Wallet
            {/if}
          </button>
        {/if}
      </div>

      <!-- Request Button -->
      {#if account}
        <button
          on:click={requestAccess}
          disabled={status === 'requesting' || status === 'processing' || status === 'connecting'}
          class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none mb-6"
        >
          {#if status === 'requesting' || status === 'processing'}
            <span class="flex items-center justify-center gap-2">
              <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {status === 'requesting' ? 'Requesting...' : 'Processing...'}
            </span>
          {:else}
            Request AI Agent Access
          {/if}
        </button>
      {/if}

      <!-- Status -->
      <div class="mb-6">
        <div class="text-center">
          <p class="text-slate-300 text-sm mb-2">Status</p>
          <p class="text-white font-medium">{getStatusMessage()}</p>
        </div>
      </div>

      <!-- Error Display -->
      {#if error}
        <div class="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
          <p class="text-red-200 text-sm">{error}</p>
        </div>
      {/if}

      <!-- Debug Info (remove in production) -->
      {#if result}
        <div class="bg-blue-500/20 border border-blue-500/50 rounded-lg p-2 mb-2 text-xs text-blue-200">
          Debug: result={result ? 'exists' : 'null'}, status={status}
        </div>
      {/if}

      <!-- Agent Interface (shown after successful payment) -->
      {#if result && status === 'success'}
        <div class="mt-6">
          <div class="bg-green-500/20 border border-green-500/50 rounded-lg p-3 mb-4">
            <p class="text-green-200 text-sm font-semibold">✓ Payment Verified • Access Granted</p>
            {#if result.payment?.txHash}
              <a
                href={`https://explorer.cronos.org/testnet/tx/${result.payment.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs text-green-300 hover:text-green-200 underline mt-1 inline-block"
              >
                View Transaction →
              </a>
            {/if}
          </div>
          
          <!-- Agent Interface -->
          <div class="agent-interface-container rounded-lg overflow-hidden border border-white/20 shadow-2xl" style="min-height: 500px; max-height: 700px;">
            <AgentInterface agentData={result} paymentData={result.payment} />
          </div>
        </div>
      {/if}
    </div>

  </div>
</div>
{/if}

