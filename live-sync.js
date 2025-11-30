/**
 * live-sync.js
 *
 * Real-time Firebase listener for orders. Keeps the kitchen view live:
 *  - Listens to /foodstand in Firebase Realtime Database
 *  - Updates window.orders automatically
 *  - Calls renderKitchenOrders() to update the UI
 *  - Provides markOrderCompleted() for completing orders
 */

(function () {
  // Avoid double initialization
  if (window._ordersRealtimeListenerAttached) return;

  function initFirebaseIfNeeded() {
    try {
      if (!window.firebase) {
        console.warn('Firebase SDK not found. Real-time sync unavailable.');
        return false;
      }
      
      if (!firebase.apps || firebase.apps.length === 0) {
        if (window.firebaseConfig && window.firebaseConfig.apiKey && window.firebaseConfig.databaseURL) {
          firebase.initializeApp(window.firebaseConfig);
          window.firebaseDb = firebase.database();
          window.firebaseConfig.configured = true;
          console.log('✅ Firebase initialized by live-sync.js');
          return true;
        } else {
          console.warn('No firebaseConfig found. Cannot initialize Firebase.');
          return false;
        }
      } else {
        if (!window.firebaseDb && firebase.database) {
          window.firebaseDb = firebase.database();
        }
        window.firebaseConfig.configured = true;
        return true;
      }
    } catch (err) {
      console.error('Error initializing Firebase:', err);
      return false;
    }
  }

  // Mark order as completed in Firebase
  window.markOrderCompleted = function (orderNumber) {
    if (!orderNumber) return;
    
    try {
      // Find order in local array
      const order = window.orders.find(o => o.orderNumber === orderNumber);
      if (order) {
        order.completed = true;
        
        // Update Firebase
        if (window.firebaseDb && window.firebaseConfig.configured) {
          const data = {
            menuItems: window.menuItems || [],
            orders: window.orders || [],
            orderCounter: window.orderCounter || 0,
            maxInventory: window.maxInventory || {},
            currentTheme: window.currentTheme || 'orange',
            siteName: window.siteName || { chinese: '美食站', english: 'Food Stand', emoji: '🍴' },
            extraOptions: window.extraOptions || [],
            nextItemId: window.nextItemId || 5,
            nextExtraOptionId: window.nextExtraOptionId || 2,
            lastUpdated: new Date().toISOString()
          };
          
          window.firebaseDb.ref('foodstand').set(data).then(() => {
            console.log('✅ Order completed and synced to Firebase');
          }).catch(err => {
            console.error('❌ Failed to sync to Firebase:', err);
          });
        }
        
        // Update UI immediately
        if (typeof window.renderKitchenOrders === 'function') {
          window.renderKitchenOrders();
        }
      }
    } catch (err) {
      console.error('markOrderCompleted error:', err);
    }
  };

  function startOrdersRealtimeListener() {
    if (window._ordersRealtimeListenerAttached) {
      console.log('📡 Orders real-time listener already attached');
      return;
    }
    
    if (!initFirebaseIfNeeded()) {
      console.log('⚠️ Cannot start real-time sync: Firebase not initialized');
      return;
    }

    try {
      const ref = window.firebaseDb.ref('foodstand');
      
      ref.on('value', snapshot => {
        const data = snapshot.val();
        
        if (!data) {
          console.log('No data in Firebase yet');
          return;
        }

        console.log('📥 Receiving data from Firebase...');

        // Update all data from Firebase
        if (data.orders && Array.isArray(data.orders)) {
          window.orders = data.orders;
        }
        
        if (data.orderCounter !== undefined) {
          window.orderCounter = data.orderCounter;
        }
        
        if (data.menuItems && Array.isArray(data.menuItems)) {
          window.menuItems = data.menuItems;
        }
        
        if (data.maxInventory) {
          window.maxInventory = data.maxInventory;
        }
        
        if (data.currentTheme) {
          window.currentTheme = data.currentTheme;
        }
        
        if (data.siteName) {
          window.siteName = data.siteName;
          if (typeof window.updateSiteName === 'function') {
            window.updateSiteName();
          }
        }
        
        if (data.extraOptions && Array.isArray(data.extraOptions)) {
          window.extraOptions = data.extraOptions;
        }
        
        if (data.nextItemId) {
          window.nextItemId = data.nextItemId;
        }
        
        if (data.nextExtraOptionId) {
          window.nextExtraOptionId = data.nextExtraOptionId;
        }

        // Update UI if render function exists
        if (typeof window.renderKitchenOrders === 'function') {
          try {
            window.renderKitchenOrders();
            console.log('✅ Kitchen view updated');
          } catch (e) {
            console.warn('renderKitchenOrders failed:', e);
          }
        }
        
        // Update menu if customer view is visible
        if (typeof window.renderMenu === 'function') {
          try {
            window.renderMenu();
          } catch (e) {
            console.warn('renderMenu failed:', e);
          }
        }
      });

      window._ordersRealtimeListenerAttached = true;
      
      const syncStatus = document.getElementById('syncStatus');
      if (syncStatus) {
        syncStatus.style.display = 'block';
        syncStatus.style.background = 'var(--success)';
        syncStatus.style.color = 'white';
        syncStatus.innerText = '🔄 即時訂單同步已啟用 | Real-time orders sync enabled';
        
        setTimeout(() => {
          syncStatus.style.display = 'none';
        }, 3000);
      }
      
      console.log('✅ Real-time sync enabled successfully!');
    } catch (err) {
      console.error('Failed to attach real-time listener:', err);
    }
  }

  function stopOrdersRealtimeListener() {
    try {
      if (!window.firebaseDb) return;
      
      const ref = window.firebaseDb.ref('foodstand');
      ref.off();
      window._ordersRealtimeListenerAttached = false;
      
      const syncStatus = document.getElementById('syncStatus');
      if (syncStatus) {
        syncStatus.style.display = 'block';
        syncStatus.style.background = 'var(--text-muted)';
        syncStatus.style.color = 'white';
        syncStatus.innerText = '⛔ 已停止即時同步 | Real-time sync stopped';
      }
      
      console.log('⛔ Real-time sync stopped');
    } catch (err) {
      console.error('stopOrdersRealtimeListener error:', err);
    }
  }

  // Expose functions globally
  window.startOrdersRealtimeListener = startOrdersRealtimeListener;
  window.stopOrdersRealtimeListener = stopOrdersRealtimeListener;

  // Override enableRealtimeSync to use our listener
  window.enableRealtimeSync = function () {
    startOrdersRealtimeListener();
  };

  // Auto-start if firebaseConfig is configured
  if (window.firebaseConfig && window.firebaseConfig.apiKey && window.firebaseConfig.databaseURL) {
    setTimeout(() => {
      try {
        console.log('🚀 Auto-starting real-time sync...');
        startOrdersRealtimeListener();
      } catch (err) {
        console.warn('Auto-start failed:', err);
      }
    }, 1000);
  }

  window._ordersRealtimeListenerAttached = false;
})();
