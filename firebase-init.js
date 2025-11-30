// firebase-init.js
// Safe initialization wrapper for Firebase and shared config

(function () {
    // Default firebaseConfig - copy your existing config here if you want auto-init.
    // The index.html (or the settings UI) can overwrite these values.
    window.firebaseConfig = window.firebaseConfig || {
      apiKey: "AIzaSyD7cWCX1_GQ1V0SCWEo5tAtmNWYX4DGwIg",
      authDomain: "german-sausage.firebaseapp.com",
      databaseURL: "https://german-sausage-default-rtdb.firebaseio.com",
      projectId: "german-sausage",
      storageBucket: "german-sausage.firebasestorage.app",
      messagingSenderId: "951839734578",
      appId: "1:951839734578:web:d0a8bf70520460cd97b52b",
      configured: false
    };
  
    // firebase database reference placeholder
    window.firebaseDb = window.firebaseDb || null;
  
    // track realtime status safely to avoid ReferenceError
    window.realtimeSyncEnabled = window.realtimeSyncEnabled || false;
  
    window.initializeFirebaseSafe = function () {
      // Do nothing if already configured
      if (window.firebaseConfig.configured && window.firebaseDb) {
        console.log('⚠️ Firebase already configured');
        return true;
      }
  
      if (!window.firebase) {
        console.error('❌ Firebase SDK not loaded (firebase-app / firebase-database)');
        return false;
      }
  
      if (!window.firebaseConfig.apiKey || !window.firebaseConfig.databaseURL) {
        console.warn('⚠️ firebaseConfig incomplete; not initializing automatically');
        return false;
      }
  
      try {
        firebase.initializeApp(window.firebaseConfig);
        window.firebaseDb = firebase.database();
        window.firebaseConfig.configured = true;
        console.log('✅ Firebase initialized successfully (firebase-init.js)');
        return true;
      } catch (err) {
        console.error('❌ Firebase init error:', err);
        return false;
      }
    };
  
    // Auto-init if config looks present (delayed slightly to allow other scripts to set config)
    setTimeout(() => {
      if (window.firebaseConfig && window.firebaseConfig.apiKey && window.firebaseConfig.databaseURL) {
        initializeFirebaseSafe();
      }
    }, 200);
  
  })();
  