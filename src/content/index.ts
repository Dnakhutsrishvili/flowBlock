// FlowBlock Content Script
// Runs on all pages to provide warnings and track time

console.log('FlowBlock: Content script loaded on', window.location.hostname);

// Track page load time for analytics
const pageLoadTime = Date.now();

// Create and inject warning toast styles
function injectStyles() {
  if (document.getElementById('flowblock-styles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'flowblock-styles';
  styles.textContent = `
    .flowblock-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 10px 40px rgba(79, 70, 229, 0.3);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 12px;
      animation: flowblock-slide-in 0.3s ease-out;
      max-width: 320px;
    }
    
    .flowblock-toast-icon {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }
    
    .flowblock-toast-content {
      flex: 1;
    }
    
    .flowblock-toast-title {
      font-weight: 600;
      margin-bottom: 2px;
    }
    
    .flowblock-toast-message {
      opacity: 0.9;
      font-size: 13px;
    }
    
    .flowblock-toast-close {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s;
    }
    
    .flowblock-toast-close:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    
    @keyframes flowblock-slide-in {
      from {
        opacity: 0;
        transform: translateX(100px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    
    @keyframes flowblock-slide-out {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(100px);
      }
    }
  `;
  document.head.appendChild(styles);
}

// Show warning toast
function showWarningToast(message: string, duration = 5000) {
  injectStyles();
  
  // Remove existing toast if present
  const existingToast = document.getElementById('flowblock-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.id = 'flowblock-toast';
  toast.className = 'flowblock-toast';
  toast.innerHTML = `
    <svg class="flowblock-toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
    <div class="flowblock-toast-content">
      <div class="flowblock-toast-title">FlowBlock</div>
      <div class="flowblock-toast-message">${message}</div>
    </div>
    <button class="flowblock-toast-close">
      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  `;
  
  document.body.appendChild(toast);
  
  // Close button handler
  const closeBtn = toast.querySelector('.flowblock-toast-close');
  closeBtn?.addEventListener('click', () => {
    dismissToast(toast);
  });
  
  // Auto dismiss
  if (duration > 0) {
    setTimeout(() => {
      dismissToast(toast);
    }, duration);
  }
}

function dismissToast(toast: HTMLElement) {
  toast.style.animation = 'flowblock-slide-out 0.3s ease-out forwards';
  setTimeout(() => {
    toast.remove();
  }, 300);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'showWarning':
      showWarningToast(message.payload?.message || 'This site is on your block list.');
      sendResponse({ success: true });
      break;
      
    case 'getTimeOnPage':
      const timeSpent = Math.round((Date.now() - pageLoadTime) / 1000);
      sendResponse({ timeSpent, hostname: window.location.hostname });
      break;
      
    case 'ping':
      sendResponse({ alive: true });
      break;
      
    default:
      sendResponse({ error: 'Unknown message type' });
  }
  
  return true;
});

// Track when user leaves page (for future analytics)
window.addEventListener('beforeunload', () => {
  const timeSpent = Math.round((Date.now() - pageLoadTime) / 1000);
  
  // Send time spent to background for tracking (fire and forget)
  chrome.runtime.sendMessage({
    type: 'pageTimeTracking',
    payload: {
      hostname: window.location.hostname,
      timeSpent,
      url: window.location.href
    }
  }).catch(() => {
    // Ignore errors on page unload
  });
});

// Export empty object to satisfy module requirements
export {};
