// sapi-admin/src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// CONFIG EN DUR (comme vous l'avez)
const firebaseConfig = {
  apiKey: "AIzaSyAnpKv7fQ-AkdUZJzL9QFe2djTwmtHhngM",
  authDomain: "sapi-54976.firebaseapp.com",
  projectId: "sapi-54976",
  storageBucket: "sapi-54976.firebasestorage.app",
  messagingSenderId: "511963758704",
  appId: "1:511963758704:web:fc5a7068647b9db77574b5",
  measurementId: "G-9D56P3MNL0"
};

console.log('🔥 Firebase Admin Config (hardcoded):', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  appId: firebaseConfig.appId
});

// ENLEVEZ la vérification des variables .env
// SUPPRIMEZ ce bloc :
// if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
//   console.error('❌ ERREUR: Configuration Firebase ADMIN manquante!');
//   console.error('Vérifiez vos variables .env pour sapi-admin');
//   console.error('API Key présente:', !!firebaseConfig.apiKey);
//   console.error('Project ID:', firebaseConfig.projectId);
// }

let adminApp;
let auth;
let db;
let storage;

try {
  // Vérification SIMPLIFIÉE
  if (!firebaseConfig.apiKey) {
    throw new Error('API Key manquante dans la config');
  }
  
  // Initialisation
  adminApp = initializeApp(firebaseConfig, 'sapi-admin-app');
  console.log('✅ Firebase ADMIN app initialisée:', adminApp.name);
  
  // Services
  auth = getAuth(adminApp);
  db = getFirestore(adminApp);
  storage = getStorage(adminApp);
  
  console.log('✅ Services initialisés');
  console.log('✅ Auth:', !!auth);
  console.log('✅ DB:', !!db);
  
} catch (error) {
  console.error('❌ Erreur d\'initialisation Firebase:', error);
  
  // Fallback (gardez votre code existant)
  auth = {
    currentUser: null,
    onAuthStateChanged: (callback) => {
      console.warn('Firebase ADMIN non initialisé - auth mock');
      return () => {};
    },
    // ...
  };
  // ...
}

export { adminApp, auth, db, storage };
export default adminApp;