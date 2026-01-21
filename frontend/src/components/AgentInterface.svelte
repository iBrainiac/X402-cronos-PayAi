<script>
  import { createEventDispatcher } from 'svelte';
  import { CONFIG } from '../config/app.js';
  
  export let agentData;
  export let paymentData;
  
  const dispatch = createEventDispatcher();
  
  // Agent state
  let userInput = '';
  let messages = [];
  let isLoading = false;
  let initialized = false;
  let messagesContainer;
  
  // Reactive statement to ensure messages trigger updates
  $: messagesCount = messages.length;
  $: {
    console.log('🔄 Messages array changed, count:', messages.length);
    console.log('📋 Current messages:', messages);
  }
  
  // Initialize with agent response (only once)
  $: if (agentData && !initialized) {
    console.log('🤖 Initializing AgentInterface with data:', agentData);
    initializeAgent();
    initialized = true;
  }
  
  // Debug: Log when component receives props
  $: if (agentData) {
    console.log('📦 AgentInterface received agentData:', agentData);
  }
  
  function initializeAgent() {
    // Add welcome message
    messages = [
      {
        type: 'system',
        content: '🤖 Agent activated! Payment verified. How can I help you?',
        timestamp: new Date().toISOString()
      }
    ];
    
    // Check for errors first
    if (agentData?.data?.error) {
      messages = [...messages, {
        type: 'error',
        content: `⚠️ ${agentData.data.message || 'Agent execution encountered an issue, but you can still chat!'}`,
        timestamp: new Date().toISOString()
      }];
    } else if (agentData?.data?.prices) {
      // If we have price data, show it
      messages = [...messages, {
        type: 'agent',
        content: formatPriceData(agentData.data.prices),
        timestamp: new Date().toISOString()
      }];
    }
    
    // Scroll to bottom after initialization
    setTimeout(() => {
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 100);
  }
  
  function formatPriceData(prices) {
    if (!prices || prices.length === 0) return 'No price data available.';
    
    let content = '📊 **Crypto Price Feed**\n\n';
    prices.forEach(coin => {
      const change = coin.change24h ? parseFloat(coin.change24h) : 0;
      const changeIcon = change >= 0 ? '📈' : '📉';
      const changeColor = change >= 0 ? 'text-green-400' : 'text-red-400';
      
      content += `**${coin.symbol}**: $${coin.price.toLocaleString()}\n`;
      if (coin.change24h !== null) {
        content += `${changeIcon} ${Math.abs(change).toFixed(2)}% (24h)\n`;
      }
      content += '\n';
    });
    
    return content;
  }
  
  async function handleSubmit() {
    if (!userInput.trim() || isLoading) return;
    
    const userMessage = userInput.trim();
    userInput = '';
    
    // Add user message (use assignment to trigger reactivity)
    const newUserMessage = {
      type: 'user',
      content: userMessage,
      timestamp: new Date().toISOString() + '-' + Date.now()
    };
    messages = [...messages, newUserMessage];
    console.log('👤 Added user message:', newUserMessage);
    console.log('📋 Total messages:', messages.length);
    console.log('📋 Messages array:', messages);
    
    // Scroll to bottom after user message
    setTimeout(() => {
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 50);
    
    isLoading = true;
    
    try {
      const agentResponse = await processAgentRequest(userMessage);
      console.log('✅ Received agent response:', agentResponse);
      
      // Add agent response (use assignment to trigger reactivity)
      const newAgentMessage = {
        type: 'agent',
        content: agentResponse,
        timestamp: new Date().toISOString() + '-' + Date.now()
      };
      messages = [...messages, newAgentMessage];
      console.log('🤖 Added agent message:', newAgentMessage);
      console.log('📝 Messages array updated, total messages:', messages.length);
      console.log('📝 Full messages array:', messages);
      
      // Force a re-render by triggering a reactive update
      messages = messages;
      
      // Scroll to bottom after message is added
      setTimeout(() => {
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 100);
    } catch (error) {
      console.error('Agent request error:', error);
      const errorMessage = error.message || 'Failed to process request';
      
      // Provide helpful error messages
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes('Failed to fetch')) {
        userFriendlyMessage = 'Cannot connect to backend. Make sure the backend server is running on ' + CONFIG.API_URL;
      } else if (errorMessage.includes('500')) {
        userFriendlyMessage = 'Backend error. Check backend logs - API key might be missing or invalid.';
      } else if (errorMessage.includes('API key')) {
        userFriendlyMessage = 'OpenAI API key not configured. Add OPENAI_API_KEY to backend/.env file.';
      }
      
      // Add error message (use assignment to trigger reactivity)
      const errorMsg = {
        type: 'error',
        content: `Error: ${userFriendlyMessage}`,
        timestamp: new Date().toISOString() + '-' + Date.now()
      };
      messages = [...messages, errorMsg];
      console.log('❌ Added error message:', errorMsg);
      console.log('📋 Total messages after error:', messages.length);
      
      // Scroll to bottom after error message
      setTimeout(() => {
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 100);
    } finally {
      isLoading = false;
    }
  }
  
  async function processAgentRequest(input) {
    console.log('📤 Sending message to backend:', input);
    console.log('🌐 API URL:', `${CONFIG.API_URL}/api/agent/chat`);
    
    // Use backend proxy (keeps API keys secure)
    const response = await fetch(`${CONFIG.API_URL}/api/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: input,
      })
    });
    
    console.log('📥 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      // Try to get error details from response
      let errorMessage = `API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        // If response isn't JSON, use status text
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log('📦 Response data:', data);
    
    if (!data.response && !data.message && !data.text) {
      console.error('❌ Invalid response format:', data);
      throw new Error('Invalid response format from backend. Expected: {response: "..."}');
    }
    
    const responseText = data.response || data.message || data.text;
    console.log('✅ Extracted response:', responseText.substring(0, 50) + '...');
    
    return responseText;
    
    // Option 2: Direct OpenAI call (NOT RECOMMENDED - exposes API key)
    // Only use this if you're okay with exposing your API key in frontend code
    /*
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer YOUR_API_KEY_HERE`, // ⚠️ Don't hardcode in production!
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: input }
        ],
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
    */
  }
  
  function formatTimestamp(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  function formatMessage(content) {
    if (!content) return '';
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/g, '<strong>$1</strong>')
      .replace(/&lt;br&gt;/g, '<br>');
  }
</script>

<div class="flex flex-col bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900" style="min-height: 500px; height: 100%;">
  <!-- Header -->
  <div class="bg-white/10 backdrop-blur-lg border-b border-white/20 p-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-white">🤖 Agent Interface</h2>
        <p class="text-slate-300 text-sm">Payment verified • Session active</p>
      </div>
      {#if paymentData?.txHash}
        <a
          href={`https://explorer.cronos.org/testnet/tx/${paymentData.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-blue-400 hover:text-blue-300 underline"
        >
          View Tx
        </a>
      {/if}
    </div>
  </div>

  <!-- Messages Area -->
  <div class="flex-1 overflow-y-auto p-4 space-y-4" bind:this={messagesContainer}>
    {#if messages.length === 0}
      <div class="flex justify-center items-center h-full">
        <p class="text-slate-400 text-sm">No messages yet. Start a conversation!</p>
      </div>
    {:else}
      {#each messages as message, index (message.timestamp + '-' + index)}
        <div class="flex {message.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in">
          <div class="max-w-[80%] rounded-lg p-3 {
            message.type === 'user' 
              ? 'bg-blue-600 text-white' 
              : message.type === 'error'
              ? 'bg-red-500/20 border border-red-500/50 text-red-200'
              : message.type === 'system'
              ? 'bg-purple-500/20 border border-purple-500/50 text-purple-200'
              : 'bg-white/10 backdrop-blur border border-white/20 text-white'
          }">
            <div class="text-sm whitespace-pre-wrap break-words">{@html formatMessage(message.content)}</div>
            <div class="text-xs opacity-70 mt-1">{formatTimestamp(message.timestamp)}</div>
          </div>
        </div>
      {/each}
    {/if}
    
    {#if isLoading}
      <div class="flex justify-start">
        <div class="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-3">
          <div class="flex items-center gap-2 text-white">
            <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-sm">Agent is thinking...</span>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Input Area -->
  <div class="bg-white/10 backdrop-blur-lg border-t border-white/20 p-4">
    <form on:submit|preventDefault={handleSubmit} class="flex gap-2">
      <input
        type="text"
        bind:value={userInput}
        placeholder="Type your message..."
        disabled={isLoading}
        class="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={!userInput.trim() || isLoading}
        class="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold px-6 py-2 rounded-lg transition-all duration-200"
      >
        Send
      </button>
    </form>
    <p class="text-xs text-slate-400 mt-2 text-center">
      💡 Tip: Modify <code class="bg-black/30 px-1 rounded">processAgentRequest()</code> in AgentInterface.svelte to integrate your API
    </p>
  </div>
</div>

<style>
  :global(.agent-interface-container) {
    height: calc(100vh - 2rem);
    max-height: 800px;
  }
  
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
</style>

