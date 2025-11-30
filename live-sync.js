/**
 * live-sync.js
 *
 * Realtime Firebase listener for orders. When enabled it keeps the kitchen view live:
 *  - Listens to /orders in Realtime Database and updates `window.orders`
 *  - Calls your page render function (if present): renderKitchenOrders() or renderOrders()
 *  - Provides fallback renderer that updates #pendingOrdersGrid and #completedOrdersGrid
 *  - Exposes startOrdersRealtimeListener(), stopOrdersRealtimeListener(), markOrderCompleted()
 *  - Provides enableRealtimeSync() so your existing button onclick="enableRealtimeSync()" works
 *
 * Usage:
 * 1. Place this file next to index.html and load it via <script src="live-sync.js"></script>
 * 2. Click the Enable Real-time Sync button in Settings (or call enableRealtimeSync()).
 *
 * Notes:
 * - This file expects firebase-compat SDK to be loaded (index.html already includes it).
 * - It will initialize firebase automatically if firebaseConfig is present and firebase.apps is empty.
 */

(function () {
  // avoid double initialization
  if (window._ordersRealtimeListenerAttached) return;

  function initFirebaseIfNeeded() {
    try {
      if (!window.firebase) {
        console.warn('Firebase SDK not found on page. Realtime sync unavailable.');
        return false;
      }
      if (!firebase.apps || firebase.apps.length === 0) {
        if (typeof window.firebaseConfig !== 'undefined' && window.firebaseConfig) {
          firebase.initializeApp(window.firebaseConfig);
          window.firebaseDb = firebase.database();
          console.log('Firebase initialized by live-sync.js');
          return true;
        } else {
          console.warn('No firebaseConfig found on page. Cannot initialize Firebase.');
          return false;
        }
      } else {
        if (!window.firebaseDb && firebase.database) {
          window.firebaseDb = firebase.database();
        }
        return true;
      }
    } catch (err) {
      console.error('Error initializing Firebase in live-sync.js', err);
      return false;
    }
  }

  // simple HTML escaping
  function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  // fallback renderer in case your app doesn't expose a render function
  function renderKitchenOrdersFallback() {
    try {
      const pendingGrid = document.getElementById('pendingOrdersGrid');
      const completedGrid = document.getElementById('completedOrdersGrid');
      const emptyPending = document.getElementById('emptyStatePending');
      const emptyCompleted = document.getElementById('emptyStateCompleted');

      if (!pendingGrid || !completedGrid) return;

      const allOrders = Array.isArray(window.orders) ? window.orders : [];

      const pending = allOrders.filter(o => !(o.completed === true || o.status === 'completed'));
      const completed = allOrders.filter(o => (o.completed === true || o.status === 'completed'));

      function makeCard(order, isCompleted) {
        const items = Array.isArray(order.items) ? order.items : (order.items ? Object.values(order.items) : []);
        const itemsHtml = items.length ? items.map(it => `<div class="order-item">${escapeHtml(it.name || it.title || '')} x ${escapeHtml(String(it.qty || it.quantity || 1))}</div>`).join('') : '<div class="order-item">（無項目）</div>';
        const orderNumber = escapeHtml(String(order.orderNumber || order.orderNum || order.id || order._id || '—'));
        const time = (order.createdAt || order.timestamp) ? new Date(order.createdAt || order.timestamp).toLocaleString() : '';
        const actionHtml = isCompleted ? `<div class="completed-badge">已完成</div>` : `<button class="complete-btn" onclick="markOrderCompleted('${escapeJs(order.id || order.key || '')}')">完成</button>`;
        return `
          <div class="order-card ${isCompleted ? 'completed' : ''}" data-order-id="${escapeHtml(order.id || order.key || '')}">
            <div class="order-card-header">
              <div>
                <div class="order-number-display">${orderNumber}</div>
                <div class="order-time">${escapeHtml(time)}</div>
              </div>
              <div style="text-align:right;">
                ${actionHtml}
              </div>
            </div>
            <div class="order-items">
              ${itemsHtml}
            </div>
          </div>
        `;
      }

      pendingGrid.innerHTML = pending.map(o => makeCard(o, false)).join('');
      completedGrid.innerHTML = completed.map(o => makeCard(o, true)).join('');

      if (emptyPending) emptyPending.style.display = pending.length ? 'none' : 'block';
      if (emptyCompleted) emptyCompleted.style.display = completed.length ? 'none' : 'block';
    } catch (err) {
      console.error('renderKitchenOrdersFallback error', err);
    }
  }

  function escapeJs(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/['\\]/g, '\\$&');
  }

  // allow marking an order completed (updates Firebase if connected)
  window.markOrderCompleted = function (orderKey) {
    if (!orderKey) return;
    try {
      if (window.firebaseDb) {
        window.firebaseDb.ref('orders/' + orderKey).update({ completed: true, completedAt: Date.now() }).then(() => {
          console.log('Order marked completed:', orderKey);
        }).catch(err => {
          console.error('Failed to mark order completed in Firebase', err);
        });
      } else {
        // fallback to local update and re-render
        if (Array.isArray(window.orders)) {
          const idx = window.orders.findIndex(o => (o.id === orderKey || o.key === orderKey));
          if (idx >= 0) {
            window.orders[idx].completed = true;
            if (typeof window.renderKitchenOrders === 'function') window.renderKitchenOrders();
            else if (typeof window.renderOrders === 'function') window.renderOrders();
            else renderKitchenOrdersFallback();
          }
        }
      }
    } catch (err) {
      console.error('markOrderCompleted error', err);
    }
  };

  function startOrdersRealtimeListener() {
    if (window._ordersRealtimeListenerAttached) {
      console.log('orders realtime listener already attached');
      return;
    }
    if (!initFirebaseIfNeeded()) return;

    try {
      const ref = window.firebaseDb.ref('orders');
      ref.on('value', snapshot => {
        const val = snapshot.val() || {};
        const arr = Object.keys(val).map(k => {
          const item = val[k];
          if (typeof item === 'object' && item !== null) {
            item.id = k;
            return item;
          } else {
            return { id: k, value: item };
          }
        });

        // sort by createdAt or orderNumber if present
        arr.sort((a, b) => {
          const at = a.createdAt || a.timestamp || a.orderNumber || 0;
          const bt = b.createdAt || b.timestamp || b.orderNumber || 0;
          return (at - bt);
        });

        window.orders = arr;

        // Prefer app-provided render functions
        if (typeof window.renderKitchenOrders === 'function') {
          try { window.renderKitchenOrders(); return; } catch (e) { console.warn('renderKitchenOrders failed', e); }
        }
        if (typeof window.renderOrders === 'function') {
          try { window.renderOrders(); return; } catch (e) { console.warn('renderOrders failed', e); }
        }

        // fallback:
        renderKitchenOrdersFallback();
      });

      window._ordersRealtimeListenerAttached = true;
      const syncStatus = document.getElementById('syncStatus');
      if (syncStatus) {
        syncStatus.style.display = 'block';
        syncStatus.style.color = 'var(--text-dark)';
        syncStatus.innerText = '🔔 即時訂單同步已啟用 | Realtime orders sync enabled';
      }
      console.log('Started orders realtime listener.');
    } catch (err) {
      console.error('Failed to attach realtime listener', err);
    }
  }

  function stopOrdersRealtimeListener() {
    try {
      if (!window.firebaseDb) return;
      const ref = window.firebaseDb.ref('orders');
      ref.off();
      window._ordersRealtimeListenerAttached = false;
      const syncStatus = document.getElementById('syncStatus');
      if (syncStatus) {
        syncStatus.style.display = 'block';
        syncStatus.style.color = 'var(--text-muted)';
        syncStatus.innerText = '⛔ 已停止即時同步 | Realtime sync stopped';
      }
      console.log('Stopped orders realtime listener.');
    } catch (err) {
      console.error('stopOrdersRealtimeListener error', err);
    }
  }

  // expose functions globally
  window.startOrdersRealtimeListener = startOrdersRealtimeListener;
  window.stopOrdersRealtimeListener = stopOrdersRealtimeListener;

  // ensure existing button onclick enableRealtimeSync() works
  window.enableRealtimeSync = function () {
    startOrdersRealtimeListener();
  };

  // auto-start if firebaseConfig.configured == true
  if (typeof window.firebaseConfig !== 'undefined' && window.firebaseConfig && window.firebaseConfig.configured) {
    setTimeout(() => {
      try { startOrdersRealtimeListener(); } catch (err) { console.warn('Auto-start failed', err); }
    }, 500);
  }

  window._ordersRealtimeListenerAttached = window._ordersRealtimeListenerAttached || false;
})();