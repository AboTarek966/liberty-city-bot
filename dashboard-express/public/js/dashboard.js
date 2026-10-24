// Dashboard client-side utilities

// API helper
const API_BASE = '/api';

async function apiFetch(endpoint, options = {}) {
  const url = API_BASE + endpoint;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  };
  
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };
  
  try {
    const response = await fetch(url, mergedOptions);
    if (response.status === 401) {
      // Token expired, try to refresh
      const refreshed = await refreshToken();
      if (refreshed) {
        // Retry original request
        return fetch(url, mergedOptions);
      } else {
        window.location.href = '/auth/discord';
        return;
      }
    }
    return response;
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
}

async function refreshToken() {
  try {
    const response = await fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Form helpers
function serializeForm(form) {
  const formData = new FormData(form);
  const data = {};
  for (const [key, value] of formData.entries()) {
    if (data[key]) {
      if (!Array.isArray(data[key])) {
        data[key] = [data[key]];
      }
      data[key].push(value);
    } else {
      data[key] = value;
    }
  }
  return data;
}

// Toast notifications
function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  const icons = { success: 'check-circle-fill', danger: 'x-circle-fill', warning: 'exclamation-triangle-fill', info: 'info-circle-fill' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.style.cssText = 'background:var(--bg-secondary,#1a2035);color:#f0f4ff;display:flex;align-items:center;gap:10px;padding:14px 18px;min-width:280px;';
  toast.innerHTML = `
    <i class="bi bi-${icons[type] || icons.info}" style="font-size:18px;"></i>
    <span style="flex:1;font-size:14px;font-weight:500;">${message}</span>
    <button type="button" class="btn-close" data-bs-dismiss="toast" style="filter:invert(1);opacity:.5;"></button>
  `;
  toastContainer.appendChild(toast);
  const bsToast = new bootstrap.Toast(toast, { delay: 3500 });
  bsToast.show();
  toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

// Save button helper with loading state
async function saveWith(btn, url, payload) {
  if (btn) {
    btn.disabled = true;
    btn.dataset.oldHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> جاري الحفظ...';
  }
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) { showToast('تم الحفظ بنجاح ✅', 'success'); return true; }
    showToast('فشل الحفظ ❌', 'danger');
    return false;
  } catch (e) {
    showToast('خطأ في الاتصال', 'danger');
    return false;
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.oldHtml; }
  }
}
window.saveWith = saveWith;

// Confirm dialog
function confirmAction(message, callback) {
  if (confirm(message)) {
    callback();
  }
}

// Copy to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('تم النسخ', 'success');
  } catch {
    showToast('فشل النسخ', 'danger');
  }
}

// Format numbers
function formatNumber(num) {
  return new Intl.NumberFormat('ar-SA').format(num);
}

// Format date
function formatDate(date) {
  return new Date(date).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Initialize tooltips and popovers
document.addEventListener('DOMContentLoaded', () => {
  // Tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
  
  // Popovers
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
  popoverTriggerList.map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));
  
  // Auto-dismiss alerts
  setTimeout(() => {
    document.querySelectorAll('.alert-dismissible').forEach(alert => {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    });
  }, 5000);
});

// Export for use in inline scripts
window.dashboardUtils = {
  apiFetch,
  showToast,
  confirmAction,
  copyToClipboard,
  formatNumber,
  formatDate,
  debounce,
};