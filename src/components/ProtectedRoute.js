import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { ShieldAlert, Loader2 } from "lucide-react";

const ProtectedRoute = ({ children, requiredRole = "Admin" }) => {
  const { user, loading, error, role, roleLoading, roleError } = useAuth();
  const location = useLocation();
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState(null);

  // VÉRIFICATION SUPPLÉMENTAIRE : Double-check avec Firestore
  useEffect(() => {
    const doubleCheckRole = async () => {
      if (!user?.uid) return;
      
      setIsValidating(true);
      setValidationError(null);

      try {
        // Vérification DIRECTE dans Firestore (pas via contexte)
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          setValidationError("User document not found in database");
          return;
        }

        const userData = userDoc.data();
        const actualRole = userData.userRole;
        
        // Log pour débogage
        console.log('🔐 Role verification:', {
          contextRole: role,
          firestoreRole: actualRole,
          required: requiredRole,
          match: actualRole === requiredRole
        });

        // Vérifier la cohérence entre contexte et Firestore
        if (role !== actualRole) {
          console.warn('⚠️ Role mismatch between context and Firestore!');
          setValidationError("Role verification failed");
        }

        // Mettre à jour localStorage seulement si admin
        if (actualRole === requiredRole) {
          localStorage.setItem('adminUser', JSON.stringify({
            uid: user.uid,
            email: user.email,
            name: userData.name || user.email,
            role: actualRole,
            lastVerified: new Date().toISOString()
          }));
        } else {
          localStorage.removeItem('adminUser');
        }

      } catch (err) {
        console.error("Role validation error:", err);
        setValidationError("Failed to verify permissions");
      } finally {
        setIsValidating(false);
      }
    };

    if (user && !loading && !roleLoading) {
      doubleCheckRole();
    }
  }, [user, role, requiredRole, loading, roleLoading]);

  // Écouter les changements d'authentification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser && location.pathname !== '/login') {
        // Déconnecté → nettoyer
        localStorage.removeItem('adminUser');
        console.log('User logged out from Firebase');
      }
    });
    return unsubscribe;
  }, [location]);

  // ========== LOGS DE DÉBOGAGE ==========
  console.log('🔐 ProtectedRoute State:', {
    user: user?.email,
    role,
    requiredRole,
    loading,
    roleLoading,
    isValidating,
    error: error?.message,
    roleError: roleError?.message,
    validationError,
    path: location.pathname
  });
  // ======================================

  // 1. Écrans de chargement
  if (loading || roleLoading || isValidating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-600">Verifying permissions...</p>
        <p className="text-sm text-gray-400 mt-2">
          Checking admin privileges...
        </p>
      </div>
    );
  }

  // 2. Erreurs
  if (error || roleError || validationError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Security Error</h2>
        <p className="text-gray-600 mb-4 text-center">
          {validationError || error?.message || roleError?.message}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
        <p className="text-sm text-gray-400 mt-4">
          If problem persists, contact system administrator
        </p>
      </div>
    );
  }

  // 3. Pas connecté → Login
  if (!user) {
    console.log('❌ No user, redirecting to login');
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 4. Vérification du rôle (CRITIQUE !)
  if (requiredRole && role !== requiredRole) {
    console.log(`❌ Role mismatch: ${role} !== ${requiredRole}`);
    
    // Logout forcé pour sécurité
    setTimeout(() => {
      auth.signOut().then(() => {
        localStorage.removeItem('adminUser');
        window.location.href = '/login';
      });
    }, 1000);
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <ShieldAlert className="h-16 w-16 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600">
          Your account ({user.email}) doesn't have admin privileges.
        </p>
        <p className="text-sm text-gray-400 mt-4">
          Redirecting to login...
        </p>
      </div>
    );
  }

  // 5. Vérifier localStorage pour double sécurité
  const storedAdmin = localStorage.getItem('adminUser');
  if (!storedAdmin) {
    console.warn('⚠️ adminUser missing in localStorage');
    // Recréer si manquant mais autorisé
    if (role === requiredRole) {
      localStorage.setItem('adminUser', JSON.stringify({
        uid: user.uid,
        email: user.email,
        role: role,
        restored: new Date().toISOString()
      }));
    }
  }

  console.log('✅ Access granted for:', user.email);
  return children;
};

export default ProtectedRoute;