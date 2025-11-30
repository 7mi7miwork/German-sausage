// popup.js
// helper UI functions: confirm modals and sync status
(function () {
    // fallback confirm dialog (used by app.js)
    window._showConfirmDialogFallback = function (message, onConfirm) {
      // Create modal DOM (transient)
      const modal = document.createElement('div');
      modal.className = 'modal show';
      modal.style.zIndex = 2000;
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
          <p style="font-size:1.1em;margin-bottom:20px;">${message}</p>
          <div style="display:flex; gap:10px; justify-content:center;">
            <button class="modal-close" style="background:var(--text-muted);" id="__confirm_cancel">取消</button>
            <button class="modal-close" id="__confirm_ok">確認</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
  
      const cleanup = () => modal.remove();
  
      modal.querySelector('#__confirm_cancel').addEventListener('click', () => cleanup());
      modal.querySelector('#__confirm_ok').addEventListener('click', () => {
        cleanup();
        try { onConfirm(); } catch (e) { console.error(e); }
      });
    };
  
    // showSyncStatus - central status banner used across the app
    window.showSyncStatus = function (message, type = 'success') {
      const statusDiv = document.getElementById('syncStatus');
      if (!statusDiv) {
        // simple fallback small toast
        console.log(`[${type}] ${message}`);
        return;
      }
      statusDiv.style.display = 'block';
      statusDiv.style.background = type === 'success' ? 'var(--success)' : 'var(--danger)';
      statusDiv.style.color = 'white';
      statusDiv.textContent = message;
      // hide after a short delay
      clearTimeout(window.__sync_status_timeout);
      window.__sync_status_timeout = setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 3000);
    };
  
    // Fix for valueAsNumber null errors - if code wants to set .valueAsNumber, always check element exists
    // Provide safe setter helper:
    window.safeSetValueAsNumber = function (elementId, number) {
      const el = document.getElementById(elementId);
      if (!el) return;
      try {
        if ('valueAsNumber' in el) el.valueAsNumber = number;
        else el.value = String(number);
      } catch (e) {
        // ignore
      }
    };
  
  })();
  