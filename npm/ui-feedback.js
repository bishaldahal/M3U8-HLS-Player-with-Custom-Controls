/**
 * HLS Video Player - UI Feedback System
 * Provides consistent user feedback: toasts, loading states, error displays
 */

const UI_FEEDBACK_CONFIG = {
  TOAST_DURATION_MS: 3000,
  TOAST_ANIMATION_MS: 300,
  MAX_TOASTS: 3,
};

class UIFeedback {
  constructor() {
    this.toastContainer = null;
    this.activeToasts = new Set();
    this.toastQueue = [];
    this._ensureContainer();
  }

  /**
   * Ensure toast container exists in DOM
   */
  _ensureContainer() {
    if (!this.toastContainer) {
      this.toastContainer = document.createElement('div');
      this.toastContainer.className = 'feedback-toast-container';
      this.toastContainer.setAttribute('aria-live', 'polite');
      this.toastContainer.setAttribute('aria-atomic', 'true');
      
      if (document.body) {
        document.body.appendChild(this.toastContainer);
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          document.body.appendChild(this.toastContainer);
        });
      }
    }
  }

  /**
   * Show toast notification
   * @param {string} message - Message to display
   * @param {string} type - Toast type: 'success', 'error', 'info', 'warning'
   * @param {number} duration - Duration in ms (0 for persistent)
   */
  showToast(message, type = 'info', duration = UI_FEEDBACK_CONFIG.TOAST_DURATION_MS) {
    // Queue if too many toasts
    if (this.activeToasts.size >= UI_FEEDBACK_CONFIG.MAX_TOASTS) {
      this.toastQueue.push({ message, type, duration });
      return;
    }

    const toast = document.createElement('div');
    toast.className = `feedback-toast feedback-toast-${type}`;
    toast.setAttribute('role', 'status');
    
    // Icon based on type
    const icon = this._getIconForType(type);
    const iconEl = document.createElement('span');
    iconEl.className = 'feedback-toast-icon';
    iconEl.innerHTML = icon;
    iconEl.setAttribute('aria-hidden', 'true');
    
    // Message
    const messageEl = document.createElement('span');
    messageEl.className = 'feedback-toast-message';
    messageEl.textContent = message;
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'feedback-toast-close';
    closeBtn.innerHTML = '×';
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.onclick = () => this._removeToast(toast);
    
    toast.appendChild(iconEl);
    toast.appendChild(messageEl);
    toast.appendChild(closeBtn);
    
    this.toastContainer.appendChild(toast);
    this.activeToasts.add(toast);
    
    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('feedback-toast-show');
    });
    
    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => this._removeToast(toast), duration);
    }
  }

  /**
   * Remove toast with animation
   */
  _removeToast(toast) {
    if (!this.activeToasts.has(toast)) return;
    
    toast.classList.remove('feedback-toast-show');
    toast.classList.add('feedback-toast-hide');
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      this.activeToasts.delete(toast);
      
      // Show queued toast
      if (this.toastQueue.length > 0) {
        const next = this.toastQueue.shift();
        this.showToast(next.message, next.type, next.duration);
      }
    }, UI_FEEDBACK_CONFIG.TOAST_ANIMATION_MS);
  }

  /**
   * Get SVG icon for toast type
   */
  _getIconForType(type) {
    const icons = {
      success: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM8 15L3 10L4.41 8.59L8 12.17L15.59 4.58L17 6L8 15Z" fill="currentColor"/>
      </svg>`,
      error: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V13H11V15ZM11 11H9V5H11V11Z" fill="currentColor"/>
      </svg>`,
      warning: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 17H19L10 2L1 17ZM11 14H9V12H11V14ZM11 10H9V6H11V10Z" fill="currentColor"/>
      </svg>`,
      info: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V9H11V15ZM11 7H9V5H11V7Z" fill="currentColor"/>
      </svg>`,
    };
    return icons[type] || icons.info;
  }

  /**
   * Show success toast
   */
  success(message, duration) {
    this.showToast(message, 'success', duration);
  }

  /**
   * Show error toast
   */
  error(message, duration) {
    this.showToast(message, 'error', duration);
  }

  /**
   * Show warning toast
   */
  warning(message, duration) {
    this.showToast(message, 'warning', duration);
  }

  /**
   * Show info toast
   */
  info(message, duration) {
    this.showToast(message, 'info', duration);
  }

  /**
   * Create loading spinner element
   * @param {string} size - Size: 'small', 'medium', 'large'
   * @returns {HTMLElement} Spinner element
   */
  createSpinner(size = 'medium') {
    const spinner = document.createElement('div');
    spinner.className = `feedback-spinner feedback-spinner-${size}`;
    spinner.setAttribute('role', 'status');
    spinner.setAttribute('aria-label', 'Loading');
    
    for (let i = 0; i < 4; i++) {
      const bar = document.createElement('div');
      bar.className = 'feedback-spinner-bar';
      spinner.appendChild(bar);
    }
    
    return spinner;
  }

  /**
   * Create loading overlay
   * @param {string} message - Loading message
   * @returns {HTMLElement} Overlay element
   */
  createLoadingOverlay(message = 'Loading...') {
    const overlay = document.createElement('div');
    overlay.className = 'feedback-loading-overlay';
    
    const content = document.createElement('div');
    content.className = 'feedback-loading-content';
    
    const spinner = this.createSpinner('large');
    const text = document.createElement('div');
    text.className = 'feedback-loading-text';
    text.textContent = message;
    
    content.appendChild(spinner);
    content.appendChild(text);
    overlay.appendChild(content);
    
    return overlay;
  }

  /**
   * Create empty state element
   * @param {Object} options - Empty state configuration
   * @returns {HTMLElement} Empty state element
   */
  createEmptyState({ icon, title, message, action } = {}) {
    const container = document.createElement('div');
    container.className = 'feedback-empty-state';
    
    if (icon) {
      const iconEl = document.createElement('div');
      iconEl.className = 'feedback-empty-icon';
      iconEl.innerHTML = icon;
      container.appendChild(iconEl);
    }
    
    if (title) {
      const titleEl = document.createElement('h3');
      titleEl.className = 'feedback-empty-title';
      titleEl.textContent = title;
      container.appendChild(titleEl);
    }
    
    if (message) {
      const messageEl = document.createElement('p');
      messageEl.className = 'feedback-empty-message';
      messageEl.textContent = message;
      container.appendChild(messageEl);
    }
    
    if (action) {
      const actionBtn = document.createElement('button');
      actionBtn.className = 'feedback-empty-action';
      actionBtn.textContent = action.label;
      actionBtn.onclick = action.onClick;
      container.appendChild(actionBtn);
    }
    
    return container;
  }

  /**
   * Create error state element
   * @param {Object} options - Error state configuration
   * @returns {HTMLElement} Error state element
   */
  createErrorState({ title, message, retry } = {}) {
    const container = document.createElement('div');
    container.className = 'feedback-error-state';
    
    const icon = document.createElement('div');
    icon.className = 'feedback-error-icon';
    icon.innerHTML = this._getIconForType('error');
    container.appendChild(icon);
    
    const titleEl = document.createElement('h3');
    titleEl.className = 'feedback-error-title';
    titleEl.textContent = title || 'Something went wrong';
    container.appendChild(titleEl);
    
    if (message) {
      const messageEl = document.createElement('p');
      messageEl.className = 'feedback-error-message';
      messageEl.textContent = message;
      container.appendChild(messageEl);
    }
    
    if (retry) {
      const retryBtn = document.createElement('button');
      retryBtn.className = 'feedback-error-retry';
      retryBtn.textContent = retry.label || 'Try Again';
      retryBtn.onclick = retry.onClick;
      container.appendChild(retryBtn);
    }
    
    return container;
  }

  /**
   * Create skeleton loader
   * @param {Object} options - Skeleton configuration
   * @returns {HTMLElement} Skeleton element
   */
  createSkeleton({ width = '100%', height = '20px', count = 1 } = {}) {
    const container = document.createElement('div');
    container.className = 'feedback-skeleton-container';
    
    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = 'feedback-skeleton';
      skeleton.style.width = width;
      skeleton.style.height = height;
      container.appendChild(skeleton);
    }
    
    return container;
  }

  /**
   * Clear all toasts
   */
  clearAll() {
    this.activeToasts.forEach(toast => this._removeToast(toast));
    this.toastQueue = [];
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.clearAll();
    if (this.toastContainer && this.toastContainer.parentNode) {
      this.toastContainer.parentNode.removeChild(this.toastContainer);
    }
    this.toastContainer = null;
  }
}

// Create singleton instance
const uiFeedback = new UIFeedback();

// Export for global use
if (typeof window !== 'undefined') {
  window.UIFeedback = uiFeedback;
}
