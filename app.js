// app.js
// Main application logic (menu, cart, orders, rendering, settings)
// Designed to work with firebase-init.js and live-sync.js

(function () {
    // ----- Data / state -----
    // Default menu items (same as you had)
    const defaultMenuItems = [
      { id: 1, emoji: '🥘', nameCh: '咖哩香腸餐盒', nameEn: 'Curry Sausage Meal Box', price: 100, canAddDrink: true },
      { id: 2, emoji: '🌭', nameCh: '美式熱狗堡', nameEn: 'American Hot Dog', price: 75, canAddDrink: true },
      { id: 3, emoji: '🍎', nameCh: '德國外婆蘋果蛋糕', nameEn: "German Grandma's Apple Cake", price: 85, canAddDrink: true },
      { id: 4, emoji: '🍊', nameCh: '農莊金桔糖漿氣泡水', nameEn: 'Farm Kumquat Syrup Sparkling Water', price: 35, canAddDrink: false }
    ];
  
    window.menuItems = window.menuItems || defaultMenuItems.slice();
    window.cart = window.cart || [];
    window.orderCounter = window.orderCounter || 0;
    window.orders = window.orders || [];
    window.maxInventory = window.maxInventory || { 1: 50, 2: 50, 3: 30, 4: 100 };
    window.currentTheme = window.currentTheme || 'orange';
    window.siteName = window.siteName || { chinese: '美食站', english: 'Food Stand', emoji: '🍴' };
    window.extraOptions = window.extraOptions || [{ id: 1, nameCh: '加購飲料', nameEn: 'Add Drink', price: 15 }];
    window.nextItemId = window.nextItemId || 5;
    window.nextExtraOptionId = window.nextExtraOptionId || 2;
  
    // Provide a safe default if firebase-init didn't create it
    window.realtimeSyncEnabled = typeof window.realtimeSyncEnabled === 'boolean' ? window.realtimeSyncEnabled : false;
  
    // locale helper for time formatting
    function formatTime(iso) {
      try {
        return new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        return iso || '';
      }
    }
  
    // ---------- Rendering functions ----------
    // Expose renderKitchenOrders (used by live-sync.js)
    window.renderKitchenOrders = function () {
      renderPendingOrders();
      renderCompletedOrders();
      renderStatistics();
    };
  
    window.renderMenu = function () {
      const menuGrid = document.getElementById('menuGrid');
      if (!menuGrid) return;
      menuGrid.innerHTML = window.menuItems.map(item => `
        <div class="menu-item">
          <div class="item-header">
            <div class="item-emoji">${item.emoji}</div>
            <div class="item-info">
              <h3>${item.nameCh}</h3>
              <div class="english">${item.nameEn}</div>
            </div>
          </div>
          <div class="item-price">${item.price} NTD</div>
          ${item.canAddDrink ? `
            <div class="add-drink-option">
              <input type="checkbox" id="drink-${item.id}" onchange="updateItemTotal(${item.id})">
              <label for="drink-${item.id}">
                加購飲料 +15 NTD<br>
                <span style="font-size: 0.9em; color: var(--text-muted);">Add Drink +15 NTD</span>
              </label>
            </div>
          ` : ''}
          <div class="quantity-control">
            <button class="qty-btn" onclick="changeQuantity(${item.id}, -1)">-</button>
            <div class="qty-display" id="qty-${item.id}">0</div>
            <button class="qty-btn" onclick="changeQuantity(${item.id}, 1)">+</button>
          </div>
          <button class="add-to-cart" onclick="addToCart(${item.id})">加入購物車 | Add to Cart</button>
        </div>
      `).join('');
    };
  
    window.updateCartDisplay = function () {
      const cartSummary = document.getElementById('cartSummary');
      const cartItems = document.getElementById('cartItems');
      const cartTotal = document.getElementById('cartTotal');
      if (!cartSummary || !cartItems || !cartTotal) return;
  
      if (cart.length === 0) {
        cartSummary.style.display = 'none';
        cartItems.innerHTML = '';
        cartTotal.textContent = '0';
        return;
      }
  
      cartSummary.style.display = 'block';
      cartItems.innerHTML = cart.map(item => `
        <div class="cart-item">
          ${item.emoji} ${item.nameCh} x${item.quantity}
          ${item.addDrink ? '<br>　　+ 飲料 (Drink)' : ''}
          <br>　　${item.totalPrice} NTD
        </div>
      `).join('');
  
      const total = cart.reduce((s, it) => s + (it.totalPrice || 0), 0);
      cartTotal.textContent = total;
    };
  
    // ---------- User actions ----------
    window.changeQuantity = function (itemId, delta) {
      const qtyDisplay = document.getElementById(`qty-${itemId}`);
      if (!qtyDisplay) return;
      let current = parseInt(qtyDisplay.textContent || '0', 10);
      current = Math.max(0, current + delta);
      qtyDisplay.textContent = current;
      updateItemTotal(itemId);
    };
  
    window.updateItemTotal = function (itemId) {
      // placeholder for future per-item live totals
    };
  
    window.addToCart = function (itemId) {
      const item = window.menuItems.find(i => i.id === itemId);
      if (!item) return;
      const qtyEl = document.getElementById(`qty-${itemId}`);
      const qty = qtyEl ? parseInt(qtyEl.textContent || '0', 10) : 0;
      if (qty <= 0) return;
  
      const addDrink = item.canAddDrink && document.getElementById(`drink-${itemId}`) ? document.getElementById(`drink-${itemId}`).checked : false;
      const totalPrice = (item.price + (addDrink ? 15 : 0)) * qty;
  
      window.cart.push({
        id: item.id,
        emoji: item.emoji,
        nameCh: item.nameCh,
        nameEn: item.nameEn,
        quantity: qty,
        addDrink,
        totalPrice
      });
  
      // reset controls
      if (qtyEl) qtyEl.textContent = '0';
      if (item.canAddDrink && document.getElementById(`drink-${itemId}`)) {
        document.getElementById(`drink-${itemId}`).checked = false;
      }
  
      window.updateCartDisplay();
    };
  
    window.submitOrder = function () {
      if (window.cart.length === 0) return;
      window.orderCounter = (window.orderCounter || 0) + 1;
      const order = {
        orderNumber: window.orderCounter,
        items: JSON.parse(JSON.stringify(window.cart)),
        total: window.cart.reduce((s, it) => s + (it.totalPrice || 0), 0),
        timestamp: new Date().toISOString(),
        completed: false
      };
  
      window.orders.unshift(order);
  
      // Save to firebase (if configured)
      saveToFirebase();
  
      // show modal
      const modalOrderNumber = document.getElementById('modalOrderNumber');
      if (modalOrderNumber) modalOrderNumber.textContent = window.orderCounter;
      const orderModal = document.getElementById('orderModal');
      if (orderModal) orderModal.classList.add('show');
  
      // clear cart
      window.cart = [];
      window.updateCartDisplay();
      renderPendingOrders();
      renderStatistics();
    };
  
    window.closeModal = function () {
      const orderModal = document.getElementById('orderModal');
      if (orderModal) orderModal.classList.remove('show');
    };
  
    // ---------- Kitchen rendering ----------
    function renderPendingOrders() {
      const pendingGrid = document.getElementById('pendingOrdersGrid');
      const emptyState = document.getElementById('emptyStatePending');
      if (!pendingGrid || !emptyState) return;
      const pending = window.orders.filter(o => !o.completed);
  
      if (pending.length === 0) {
        pendingGrid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
      }
      emptyState.style.display = 'none';
  
      pendingGrid.innerHTML = pending.map(order => `
        <div class="order-card">
          <div class="order-card-header">
            <div class="order-number-display">#${order.orderNumber}</div>
            <div class="order-time">${formatTime(order.timestamp)}</div>
          </div>
          <div class="order-items">
            ${order.items.map(item => `
              <div class="order-item">
                ${item.emoji} ${item.nameCh} x${item.quantity}
                ${item.addDrink ? '<br>　　+ 飲料 (Drink)' : ''}
              </div>
            `).join('')}
          </div>
          <div class="cart-total" style="font-size: 1.3em;">總計 Total: ${order.total} NTD</div>
          <button class="complete-btn" onclick="completeOrder(${order.orderNumber})">✅ 完成訂單 | Complete Order</button>
        </div>
      `).join('');
    }
  
    function renderCompletedOrders() {
      const completedGrid = document.getElementById('completedOrdersGrid');
      const emptyState = document.getElementById('emptyStateCompleted');
      if (!completedGrid || !emptyState) return;
      const completed = window.orders.filter(o => o.completed);
  
      if (completed.length === 0) {
        completedGrid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
      }
      emptyState.style.display = 'none';
  
      completedGrid.innerHTML = completed.map(order => `
        <div class="order-card completed">
          <div class="order-card-header">
            <div class="order-number-display">#${order.orderNumber}</div>
            <div class="order-time">${formatTime(order.timestamp)}</div>
          </div>
          <div class="order-items">
            ${order.items.map(item => `
              <div class="order-item">
                ${item.emoji} ${item.nameCh} x${item.quantity}
                ${item.addDrink ? '<br>　　+ 飲料 (Drink)' : ''}
              </div>
            `).join('')}
          </div>
          <div class="cart-total" style="font-size: 1.3em;">總計 Total: ${order.total} NTD</div>
          <div class="completed-badge">✅ 已完成 Completed</div>
        </div>
      `).join('');
    }
  
    window.completeOrder = function (orderNumber) {
      const ord = window.orders.find(o => o.orderNumber === orderNumber);
      if (!ord) return;
      ord.completed = true;
      // update UI
      renderPendingOrders();
      renderCompletedOrders();
      renderStatistics();
      // persist
      saveToFirebase();
    };
  
    // ---------- Statistics & Settings UI ----------
    function calculateItemStats() {
      const stats = {};
      window.menuItems.forEach(item => stats[item.id] = 0);
      window.orders.forEach(order => {
        (order.items || []).forEach(i => {
          if (stats[i.id] === undefined) stats[i.id] = 0;
          stats[i.id] += i.quantity || 0;
        });
      });
      return stats;
    }
  
    function renderStatistics() {
      const statsGrid = document.getElementById('statisticsGrid');
      if (!statsGrid) return;
      const stats = calculateItemStats();
  
      statsGrid.innerHTML = window.menuItems.map(item => {
        const sold = stats[item.id] || 0;
        const max = window.maxInventory[item.id] || 0;
        const percentage = max > 0 ? (sold / max) * 100 : 0;
        let progressClass = '';
        if (percentage >= 90) progressClass = 'danger';
        else if (percentage >= 70) progressClass = 'warning';
  
        return `
          <div class="stat-card">
            <div class="stat-header">
              <div class="stat-emoji">${item.emoji}</div>
              <div>
                <div class="stat-name">${item.nameCh}</div>
                <div style="font-size: 0.85em; color: var(--text-muted);">${item.nameEn}</div>
              </div>
            </div>
            <div class="stat-numbers">
              <div class="stat-count">
                <div class="stat-label">已售出 | Sold</div>
                <div class="stat-value">${sold}</div>
              </div>
              <div style="font-size: 1.5em; color: var(--text-muted);">/</div>
              <div class="stat-count">
                <div class="stat-label">最大量 | Max</div>
                <div class="stat-max">${max}</div>
              </div>
            </div>
            <div class="progress-bar">
              <div class="progress-fill ${progressClass}" style="width: ${Math.min(percentage, 100)}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  
    window.renderSettings = function () {
      const settingsGrid = document.getElementById('settingsGrid');
      if (!settingsGrid) return;
      settingsGrid.innerHTML = window.menuItems.map(item => `
        <div class="settings-card">
          <div class="stat-header">
            <div class="stat-emoji">${item.emoji}</div>
            <div>
              <div class="stat-name">${item.nameCh}</div>
              <div style="font-size: 0.85em; color: var(--text-muted);">${item.nameEn}</div>
            </div>
          </div>
          <label style="font-size: 0.9em; color: var(--text-muted);">最大庫存量 | Max Inventory</label>
          <input type="number" class="settings-input" value="${window.maxInventory[item.id] || 0}"
            onchange="updateMaxInventory(${item.id}, this.value)" min="0">
        </div>
      `).join('');
    };
  
    window.updateMaxInventory = function (itemId, value) {
      window.maxInventory[itemId] = parseInt(value || '0', 10) || 0;
      renderStatistics();
      saveToFirebase();
    };
  
    // ---------- Menu management (admin) ----------
    window.renderMenuManagement = function () {
      const grid = document.getElementById('menuManagementGrid');
      if (!grid) return;
      grid.innerHTML = window.menuItems.map(item => `
        <div class="settings-card">
          <div class="stat-header">
            <div class="stat-emoji">${item.emoji}</div>
            <div>
              <div class="stat-name">${item.nameCh}</div>
              <div style="font-size: 0.85em; color: var(--text-muted);">${item.nameEn}</div>
            </div>
          </div>
          <div style="margin-top: 15px;">
            <div style="font-size: 1.3em; color: var(--secondary); font-weight: 700;">${item.price} NTD</div>
          </div>
          <div style="margin-top: 15px; display: flex; gap: 10px;">
            <button class="complete-btn" onclick="editItem(${item.id})" style="flex: 1; background: var(--secondary);">✏️ 編輯 | Edit</button>
            <button class="complete-btn" onclick="deleteItem(${item.id})" style="flex: 1; background: var(--danger);">🗑️ 刪除 | Delete</button>
          </div>
        </div>
      `).join('');
    };
  
    window.showAddItemModal = function () {
      const title = document.getElementById('itemModalTitle');
      if (title) title.textContent = '➕ 新增菜單項目 | Add Menu Item';
      const editId = document.getElementById('editItemId');
      if (editId) editId.value = '';
      const itemEmoji = document.getElementById('itemEmoji');
      const itemNameCh = document.getElementById('itemNameCh');
      const itemNameEn = document.getElementById('itemNameEn');
      const itemPrice = document.getElementById('itemPrice');
      const itemMaxInventory = document.getElementById('itemMaxInventory');
  
      if (itemEmoji) itemEmoji.value = '';
      if (itemNameCh) itemNameCh.value = '';
      if (itemNameEn) itemNameEn.value = '';
      if (itemPrice) itemPrice.value = '';
      if (itemMaxInventory) itemMaxInventory.value = '50';
  
      const modal = document.getElementById('itemModal');
      if (modal) modal.classList.add('show');
    };
  
    window.editItem = function (itemId) {
      const item = window.menuItems.find(i => i.id === itemId);
      if (!item) return;
  
      const title = document.getElementById('itemModalTitle');
      if (title) title.textContent = '✏️ 編輯菜單項目 | Edit Menu Item';
      const editId = document.getElementById('editItemId');
      const itemEmoji = document.getElementById('itemEmoji');
      const itemNameCh = document.getElementById('itemNameCh');
      const itemNameEn = document.getElementById('itemNameEn');
      const itemPrice = document.getElementById('itemPrice');
      const itemMaxInventory = document.getElementById('itemMaxInventory');
  
      if (editId) editId.value = item.id;
      if (itemEmoji) itemEmoji.value = item.emoji;
      if (itemNameCh) itemNameCh.value = item.nameCh;
      if (itemNameEn) itemNameEn.value = item.nameEn;
      if (itemPrice) itemPrice.value = item.price;
      if (itemMaxInventory) itemMaxInventory.value = window.maxInventory[item.id] || 50;
  
      const modal = document.getElementById('itemModal');
      if (modal) modal.classList.add('show');
    };
  
    window.saveItem = function () {
      const editId = document.getElementById('editItemId').value;
      const emoji = (document.getElementById('itemEmoji').value || '').trim();
      const nameCh = (document.getElementById('itemNameCh').value || '').trim();
      const nameEn = (document.getElementById('itemNameEn').value || '').trim();
      const price = parseInt(document.getElementById('itemPrice').value || '0', 10) || 0;
      const maxInv = parseInt(document.getElementById('itemMaxInventory').value || '0', 10) || 50;
  
      if (!emoji || !nameCh || !nameEn || price <= 0) {
        showSyncStatus('請填寫所有欄位 | Please fill all fields', 'error');
        return;
      }
  
      if (editId) {
        const item = window.menuItems.find(i => i.id === parseInt(editId, 10));
        if (item) {
          item.emoji = emoji;
          item.nameCh = nameCh;
          item.nameEn = nameEn;
          item.price = price;
          window.maxInventory[item.id] = maxInv;
        }
      } else {
        const newItem = { id: window.nextItemId++, emoji, nameCh, nameEn, price, canAddDrink: true };
        window.menuItems.push(newItem);
        window.maxInventory[newItem.id] = maxInv;
      }
  
      const modal = document.getElementById('itemModal');
      if (modal) modal.classList.remove('show');
  
      window.renderMenu();
      window.renderMenuManagement();
      window.renderSettings();
      window.renderStatistics();
      saveToFirebase();
    };
  
    window.deleteItem = function (itemId) {
      showConfirmDialog('確定要刪除此項目嗎？| Are you sure you want to delete this item?', () => {
        const idx = window.menuItems.findIndex(i => i.id === itemId);
        if (idx !== -1) {
          window.menuItems.splice(idx, 1);
          delete window.maxInventory[itemId];
          window.renderMenu();
          window.renderMenuManagement();
          window.renderStatistics();
          saveToFirebase();
        }
      });
    };
  
    // Extra options management (add/edit/delete) simplified
    window.renderExtraOptionsManagement = function () {
      const grid = document.getElementById('extraOptionsGrid');
      if (!grid) return;
      grid.innerHTML = window.extraOptions.map(opt => `
        <div class="settings-card">
          <div>
            <div class="stat-name">${opt.nameCh}</div>
            <div style="font-size: 0.85em; color: var(--text-muted);">${opt.nameEn}</div>
          </div>
          <div style="margin-top: 15px;">
            <div style="font-size: 1.3em; color: var(--secondary); font-weight: 700;">+${opt.price} NTD</div>
          </div>
          <div style="margin-top: 15px; display: flex; gap: 10px;">
            <button class="complete-btn" onclick="editExtraOption(${opt.id})" style="flex:1;background:var(--secondary)">✏️ 編輯</button>
            <button class="complete-btn" onclick="deleteExtraOption(${opt.id})" style="flex:1;background:var(--danger)">🗑️ 刪除</button>
          </div>
        </div>
      `).join('');
    };
  
    window.showAddExtraOptionModal = function () {
      document.getElementById('editExtraOptionId').value = '';
      document.getElementById('extraOptionNameCh').value = '';
      document.getElementById('extraOptionNameEn').value = '';
      document.getElementById('extraOptionPrice').value = '';
      document.getElementById('extraOptionModal').classList.add('show');
    };
  
    window.editExtraOption = function (id) {
      const opt = window.extraOptions.find(o => o.id === id);
      if (!opt) return;
      document.getElementById('editExtraOptionId').value = opt.id;
      document.getElementById('extraOptionNameCh').value = opt.nameCh;
      document.getElementById('extraOptionNameEn').value = opt.nameEn;
      document.getElementById('extraOptionPrice').value = opt.price;
      document.getElementById('extraOptionModal').classList.add('show');
    };
  
    window.saveExtraOption = function () {
      const editId = document.getElementById('editExtraOptionId').value;
      const nameCh = (document.getElementById('extraOptionNameCh').value || '').trim();
      const nameEn = (document.getElementById('extraOptionNameEn').value || '').trim();
      const price = parseInt(document.getElementById('extraOptionPrice').value || '0', 10) || 0;
  
      if (!nameCh || !nameEn || price <= 0) {
        showSyncStatus('請填寫所有欄位 | Please fill all fields', 'error');
        return;
      }
  
      if (editId) {
        const opt = window.extraOptions.find(o => o.id === parseInt(editId, 10));
        if (opt) {
          opt.nameCh = nameCh; opt.nameEn = nameEn; opt.price = price;
        }
      } else {
        window.extraOptions.push({ id: window.nextExtraOptionId++, nameCh, nameEn, price });
      }
  
      document.getElementById('extraOptionModal').classList.remove('show');
      window.renderExtraOptionsManagement();
      saveToFirebase();
    };
  
    window.deleteExtraOption = function (id) {
      showConfirmDialog('確定要刪除此選項嗎？| Are you sure?', () => {
        const idx = window.extraOptions.findIndex(o => o.id === id);
        if (idx !== -1) {
          window.extraOptions.splice(idx, 1);
          window.renderExtraOptionsManagement();
          saveToFirebase();
        }
      });
    };
  
    // ---------- Confirm / status UI helpers ----------
    // These are small utility functions used by many places.
    window.showConfirmDialog = function (message, onConfirm) {
      // Implementation uses popup.js showConfirmDialog if present, otherwise a simple fallback.
      if (typeof window._showConfirmDialogFallback === 'function') {
        window._showConfirmDialogFallback(message, onConfirm);
        return;
      }
  
      // Fallback: use window.confirm
      if (confirm(message.replace(/<br>/g, '\n').replace(/\|.*$/, ''))) {
        onConfirm();
      }
    };
  
    window.showSyncStatus = function (message, type = 'success') {
      // popup.js provides showSyncStatus; if not available, do a console.log and a simple temporary banner.
      const statusDiv = document.getElementById('syncStatus');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.background = type === 'success' ? 'var(--success)' : 'var(--danger)';
        statusDiv.style.color = 'white';
        statusDiv.textContent = message;
        setTimeout(() => {
          statusDiv.style.display = 'none';
        }, 3000);
      } else {
        console.log(`[${type}] ${message}`);
      }
    };
  
    // ---------- Firebase save/load ----------
    // These functions rely on window.firebaseConfig and window.firebaseDb from firebase-init.js
    window.saveToFirebase = async function () {
      if (!window.firebaseConfig || !window.firebaseConfig.configured || !window.firebaseDb) {
        console.warn('⚠️ skip saveToFirebase: Firebase not configured');
        return;
      }
  
      const data = {
        menuItems: window.menuItems,
        orders: window.orders,
        orderCounter: window.orderCounter,
        maxInventory: window.maxInventory,
        currentTheme: window.currentTheme,
        siteName: window.siteName,
        extraOptions: window.extraOptions,
        nextItemId: window.nextItemId,
        nextExtraOptionId: window.nextExtraOptionId,
        lastUpdated: new Date().toISOString()
      };
  
      try {
        await window.firebaseDb.ref('foodstand').set(data);
        console.log('✅ Successfully saved to Firebase');
        window.showSyncStatus && showSyncStatus('✅ 已同步到Firebase | Synced to Firebase', 'success');
      } catch (err) {
        console.error('❌ Firebase save failed:', err);
        window.showSyncStatus && showSyncStatus('❌ Firebase同步失敗 | Firebase sync failed', 'error');
      }
    };
  
    window.loadFromFirebase = async function () {
      if (!window.firebaseConfig || !window.firebaseConfig.configured || !window.firebaseDb) {
        console.warn('⚠️ skip loadFromFirebase: Firebase not configured');
        return;
      }
  
      try {
        const snapshot = await window.firebaseDb.ref('foodstand').once('value');
        const data = snapshot.val();
        if (!data) {
          console.log('No data in Firebase; keeping defaults and saving back.');
          saveToFirebase();
          return;
        }
  
        if (Array.isArray(data.menuItems)) {
          window.menuItems.length = 0;
          window.menuItems.push(...data.menuItems);
        }
        if (Array.isArray(data.orders)) {
          window.orders.length = 0;
          window.orders.push(...data.orders);
        }
        window.orderCounter = data.orderCounter || window.orderCounter || 0;
        if (data.maxInventory) Object.assign(window.maxInventory, data.maxInventory);
        if (data.currentTheme) { window.currentTheme = data.currentTheme; }
        if (data.siteName) Object.assign(window.siteName, data.siteName);
        if (Array.isArray(data.extraOptions)) {
          window.extraOptions.length = 0; window.extraOptions.push(...data.extraOptions);
        }
        window.nextItemId = data.nextItemId || window.nextItemId;
        window.nextExtraOptionId = data.nextExtraOptionId || window.nextExtraOptionId;
  
        // Re-render UI
        window.renderMenu();
        window.updateCartDisplay();
        updateSiteName();
        renderSettings();
        renderStatistics();
        renderPendingOrders();
        renderCompletedOrders();
  
        console.log('✅ Data loaded from Firebase');
      } catch (err) {
        console.error('❌ Firebase load failed:', err);
      }
    };
  
    // ---------- Site name helpers ----------
    function updateSiteName() {
      const header = document.querySelector('.header h1');
      if (header) {
        header.innerHTML = `${window.siteName.emoji} ${window.siteName.chinese} ${window.siteName.english}`;
      }
    }
  
    window.saveSiteName = function () {
      const emoji = document.getElementById('siteEmoji');
      const ch = document.getElementById('siteNameCh');
      const en = document.getElementById('siteNameEn');
      if (emoji) window.siteName.emoji = emoji.value.trim() || window.siteName.emoji || '🍴';
      if (ch) window.siteName.chinese = ch.value.trim() || window.siteName.chinese || '美食站';
      if (en) window.siteName.english = en.value.trim() || window.siteName.english || 'Food Stand';
      updateSiteName();
      saveToFirebase();
      showSyncStatus('✅ 站點名稱已更新 | Site name updated', 'success');
    };
  
    window.loadSiteNameToSettings = function () {
      const emoji = document.getElementById('siteEmoji');
      const ch = document.getElementById('siteNameCh');
      const en = document.getElementById('siteNameEn');
      if (emoji) emoji.value = window.siteName.emoji || '';
      if (ch) ch.value = window.siteName.chinese || '';
      if (en) en.value = window.siteName.english || '';
    };
  
    // ---------- Theme selector ----------
    window.applyTheme = function (themeKey) {
      // colorThemes are defined in original index.html; we only update CSS vars here.
      const colorThemes = {
        orange: { primary: '#FF6B35', secondary: '#F7931E', accent: '#FDC830' },
        blue: { primary: '#3B82F6', secondary: '#60A5FA', accent: '#93C5FD' },
        green: { primary: '#10B981', secondary: '#34D399', accent: '#6EE7B7' },
        purple: { primary: '#8B5CF6', secondary: '#A78BFA', accent: '#C4B5FD' },
        red: { primary: '#EF4444', secondary: '#F87171', accent: '#FCA5A5' }
      };
      if (!colorThemes[themeKey]) return;
      window.currentTheme = themeKey;
      const theme = colorThemes[themeKey];
      const root = document.documentElement;
      if (root && theme) {
        root.style.setProperty('--primary', theme.primary);
        root.style.setProperty('--secondary', theme.secondary);
        root.style.setProperty('--accent', theme.accent);
      }
      // re-render selector if present
      try { renderColorThemeSelector(); } catch (e) {}
      saveToFirebase();
    };
  
    window.renderColorThemeSelector = function () {
      const selector = document.getElementById('colorThemeSelector');
      if (!selector) return;
      const colorThemes = {
        orange: { name: '橙色主題 | Orange', primary: '#FF6B35', secondary: '#F7931E', accent: '#FDC830' },
        blue: { name: '藍色主題 | Blue', primary: '#3B82F6', secondary: '#60A5FA', accent: '#93C5FD' },
        green: { name: '綠色主題 | Green', primary: '#10B981', secondary: '#34D399', accent: '#6EE7B7' },
        purple: { name: '紫色主題 | Purple', primary: '#8B5CF6', secondary: '#A78BFA', accent: '#C4B5FD' },
        red: { name: '紅色主題 | Red', primary: '#EF4444', secondary: '#F87171', accent: '#FCA5A5' }
      };
  
      selector.innerHTML = Object.keys(colorThemes).map(key => {
        const t = colorThemes[key];
        const border = window.currentTheme === key ? 'border: 3px solid var(--primary);' : '';
        return `
          <div class="settings-card" onclick="applyTheme('${key}')" style="cursor:pointer; ${border}">
            <h3 style="margin-bottom:15px;">${t.name}</h3>
            <div style="display:flex; gap:10px;">
              <div style="width:60px;height:60px;border-radius:12px;background:${t.primary};"></div>
              <div style="width:60px;height:60px;border-radius:12px;background:${t.secondary};"></div>
              <div style="width:60px;height:60px;border-radius:12px;background:${t.accent};"></div>
            </div>
          </div>
        `;
      }).join('');
    };
  
    // ---------- Tabs and kitchen controls ----------
    window.switchView = function (view) {
      const customerView = document.getElementById('customerView');
      const kitchenView = document.getElementById('kitchenView');
      const buttons = document.querySelectorAll('.view-toggle .toggle-btn');
  
      if (view === 'customer') {
        if (customerView) customerView.classList.remove('hidden');
        if (kitchenView) kitchenView.classList.add('hidden');
        if (buttons[0]) buttons[0].classList.add('active');
        if (buttons[1]) buttons[1].classList.remove('active');
      } else {
        // open password modal if not authenticated
        if (!window.isKitchenAuthenticated) {
          const pm = document.getElementById('passwordModal');
          if (pm) {
            pm.classList.add('show');
            const passwordInput = document.getElementById('passwordInput');
            if (passwordInput) {
              passwordInput.value = '';
              passwordInput.focus();
            }
          }
          return;
        }
        if (customerView) customerView.classList.add('hidden');
        if (kitchenView) kitchenView.classList.remove('hidden');
        if (buttons[0]) buttons[0].classList.remove('active');
        if (buttons[1]) buttons[1].classList.add('active');
        renderKitchenView();
      }
    };
  
    window.KITCHEN_PASSWORD = '1234';
    window.isKitchenAuthenticated = false;
  
    window.verifyPassword = function () {
      const input = document.getElementById('passwordInput');
      const error = document.getElementById('passwordError');
      if (!input) return;
      if (input.value === window.KITCHEN_PASSWORD) {
        window.isKitchenAuthenticated = true;
        const modal = document.getElementById('passwordModal');
        if (modal) modal.classList.remove('show');
        window.switchView('kitchen');
      } else {
        if (error) error.style.display = 'block';
        input.value = '';
        input.focus();
      }
    };
  
    window.closePasswordModal = function () {
      const pm = document.getElementById('passwordModal');
      if (pm) pm.classList.remove('show');
    };
  
    window.renderKitchenView = function () {
      renderStatistics();
      window.renderSettings && window.renderSettings();
      renderPendingOrders();
      renderCompletedOrders();
    };
  
    // periodic UI refresh (for safety)
    setInterval(() => {
      const kv = document.getElementById('kitchenView');
      if (!kv || kv.classList.contains('hidden')) return;
      const ordersTab = document.getElementById('ordersTab');
      if (ordersTab && !ordersTab.classList.contains('hidden')) {
        renderPendingOrders();
        renderCompletedOrders();
      }
    }, 3000);
  
    // Admin helpers
    window.clearCompletedOrders = function () {
      showConfirmDialog('確定要清除所有已完成訂單嗎？此操作無法復原。<br>Are you sure?', () => {
        window.orders = window.orders.filter(o => !o.completed);
        renderPendingOrders(); renderCompletedOrders(); renderStatistics();
        saveToFirebase();
        showSyncStatus('✅ 已完成訂單已清除 | Completed orders cleared', 'success');
      });
    };
  
    window.resetAllOrders = function () {
      showConfirmDialog('⚠️ 確定要重置所有訂單嗎？<br>Are you sure?', () => {
        window.orders = [];
        renderPendingOrders(); renderCompletedOrders(); renderStatistics();
        saveToFirebase();
        showSyncStatus('✅ 所有訂單已重置 | All orders reset', 'success');
      });
    };
  
    window.resetOrderCounter = function () {
      showConfirmDialog('確定要重置訂單編號計數器嗎？', () => {
        window.orderCounter = 0;
        saveToFirebase();
        showSyncStatus('✅ 訂單編號已重置 | Order counter reset', 'success');
      });
    };
  
    // load saved firebase config UI
    window.loadFirebaseConfigFromMemory = function () {
      const f = window.firebaseConfig || {};
      if (document.getElementById('apiKeyInput')) {
        document.getElementById('apiKeyInput').value = f.apiKey || '';
        document.getElementById('authDomainInput').value = f.authDomain || '';
        document.getElementById('databaseURLInput').value = f.databaseURL || '';
        document.getElementById('projectIdInput').value = f.projectId || '';
        document.getElementById('storageBucketInput').value = f.storageBucket || '';
        document.getElementById('messagingSenderIdInput').value = f.messagingSenderId || '';
        document.getElementById('appIdInput').value = f.appId || '';
      }
    };
  
    window.saveFirebaseConfig = function () {
      // read from inputs (if present)
      const apiKey = (document.getElementById('apiKeyInput') || {}).value || '';
      const authDomain = (document.getElementById('authDomainInput') || {}).value || '';
      const databaseURL = (document.getElementById('databaseURLInput') || {}).value || '';
      const projectId = (document.getElementById('projectIdInput') || {}).value || '';
      const storageBucket = (document.getElementById('storageBucketInput') || {}).value || '';
      const messagingSenderId = (document.getElementById('messagingSenderIdInput') || {}).value || '';
      const appId = (document.getElementById('appIdInput') || {}).value || '';
  
      window.firebaseConfig = Object.assign(window.firebaseConfig || {}, {
        apiKey: apiKey.trim(),
        authDomain: authDomain.trim(),
        databaseURL: databaseURL.trim(),
        projectId: projectId.trim(),
        storageBucket: storageBucket.trim(),
        messagingSenderId: messagingSenderId.trim(),
        appId: appId.trim(),
        configured: window.firebaseConfig && window.firebaseConfig.configured ? true : false
      });
  
      if (window.firebaseConfig.apiKey && window.firebaseConfig.databaseURL) {
        // try initialize
        const ok = window.initializeFirebaseSafe ? window.initializeFirebaseSafe() : false;
        if (ok) {
          showSyncStatus('Firebase設定已儲存 | Firebase config saved', 'success');
          // load data and enable realtime
          window.loadFromFirebase && window.loadFromFirebase();
          // attempt to enable realtime via live-sync.js (it will auto-start if config exists)
        } else {
          showSyncStatus('Firebase初始化失敗 | Firebase init failed', 'error');
        }
      } else {
        showSyncStatus('請填寫必要欄位 | Please fill required fields', 'error');
      }
    };
  
    // wire up password 'Enter' key
    document.addEventListener('DOMContentLoaded', () => {
      const passwordInput = document.getElementById('passwordInput');
      if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') verifyPassword();
        });
      }
      // initial render
      window.renderMenu();
      window.updateCartDisplay();
      updateSiteName();
      window.loadFirebaseConfigFromMemory();
      window.renderColorThemeSelector && window.renderColorThemeSelector();
    });
  
  })();
  