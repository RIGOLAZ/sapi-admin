import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, GithubAuthProvider, signOut } from "firebase/auth";
import { auth, db } from '../firebase/config';
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "react-toastify";
import { Mail, Lock, Loader2, Eye, EyeOff, Github, Shield, AlertCircle, Globe } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState({ google: false, github: false });
  const [debugInfo, setDebugInfo] = useState("");
  const navigate = useNavigate();

  // Afficher le domaine actuel pour débogage
  useEffect(() => {
    console.log("Domaine actuel:", window.location.hostname);
    console.log("URL complète:", window.location.href);
  }, []);

  // Rediriger si déjà connecté en tant qu'admin
  useEffect(() => {
    const checkExistingSession = async () => {
      const storedUser = localStorage.getItem('adminUser');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          if (userData.role === "Admin" && auth.currentUser) {
            // Vérifier que l'utilisateur est toujours admin
            const userDocRef = doc(db, "users", userData.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists() && userDoc.data().userRole === "Admin") {
              navigate("/");
            } else {
              await handleLogout();
            }
          }
        } catch (error) {
          console.error("Erreur session:", error);
          localStorage.removeItem('adminUser');
        }
      }
    };
    checkExistingSession();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    } finally {
      localStorage.removeItem('adminUser');
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Veuillez saisir un email et un mot de passe.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setDebugInfo(`Tentative de connexion depuis: ${window.location.hostname}`);

    try {
      console.log("Tentative de connexion depuis le domaine:", window.location.hostname);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("Firebase Auth réussi, UID:", user.uid);

      // Vérifier le rôle admin dans Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Vérification stricte du rôle admin
        if (userData.userRole === "Admin") {
          // Mettre à jour la dernière connexion
          await setDoc(userDocRef, {
            lastLoginAt: serverTimestamp()
          }, { merge: true });

          // Stocker les infos utilisateur
          const adminUserData = {
            uid: user.uid,
            email: user.email,
            name: userData.name || user.email,
            role: userData.userRole,
            lastLogin: new Date().toISOString()
          };
          
          localStorage.setItem('adminUser', JSON.stringify(adminUserData));
          
          toast.success("Connexion administrateur réussie !");
          navigate("/");
        } else {
          await handleLogout();
          setErrorMessage(`Accès refusé. Votre rôle: ${userData.userRole}. Seuls les administrateurs peuvent accéder.`);
          setDebugInfo(`Rôle détecté: ${userData.userRole} (Admin requis)`);
          toast.error("Accès administrateur requis");
        }
      } else {
        await handleLogout();
        setErrorMessage("Compte utilisateur non trouvé dans le système. Contactez un administrateur.");
        setDebugInfo("Document Firestore non trouvé");
        toast.error("Compte non enregistré");
      }
    } catch (error) {
      console.error("Erreur détaillée de connexion:", error);
      console.log("Code d'erreur:", error?.code);
      console.log("Message d'erreur:", error?.message);
      
      let errorMsg = "Échec de la connexion.";
      let debugMsg = `Domaine: ${window.location.hostname}`;
      
      if (error?.code) {
        switch (error.code) {
          case 'auth/invalid-email': 
            errorMsg = "Format d'email invalide."; 
            debugMsg += " | Email invalide";
            break;
          case 'auth/user-disabled': 
            errorMsg = "Ce compte a été désactivé."; 
            debugMsg += " | Compte désactivé";
            break;
          case 'auth/user-not-found': 
            errorMsg = "Aucun compte avec cet email."; 
            debugMsg += " | Email non trouvé";
            break;
          case 'auth/wrong-password': 
            errorMsg = "Mot de passe incorrect."; 
            debugMsg += " | Mot de passe incorrect";
            break;
          case 'auth/invalid-credential': 
            errorMsg = "Identifiants invalides. Vérifiez votre email et mot de passe."; 
            debugMsg += " | Identifiants invalides";
            break;
          case 'auth/too-many-requests': 
            errorMsg = "Trop de tentatives. Réessayez plus tard."; 
            debugMsg += " | Trop de tentatives";
            break;
          case 'auth/network-request-failed': 
            errorMsg = "Erreur réseau. Vérifiez votre connexion."; 
            debugMsg += " | Erreur réseau";
            break;
          case 'auth/operation-not-allowed':
            errorMsg = "La connexion par email/mot de passe n'est pas activée."; 
            debugMsg += " | Méthode non activée";
            break;
          case 'auth/unauthorized-domain':
            errorMsg = "Domaine non autorisé pour l'authentification."; 
            debugMsg += " | DOMAINE NON AUTORISÉ - Ajoutez ce domaine dans Firebase Console";
            break;
          default:
            errorMsg = `Erreur: ${error.code}. ${error.message || "Veuillez réessayer."}`;
            debugMsg += ` | Code: ${error.code}`;
        }
      } else if (error?.message) {
        errorMsg = error.message;
      }
      
      setErrorMessage(errorMsg);
      setDebugInfo(debugMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (providerType) => {
    setSocialLoading(prev => ({ ...prev, [providerType]: true }));
    setErrorMessage("");
    setDebugInfo(`Tentative de connexion ${providerType} depuis: ${window.location.hostname}`);

    const provider = providerType === 'google' ? new GoogleAuthProvider() : new GithubAuthProvider();

    if (providerType === 'github') {
      provider.addScope('user:email');
    }

    try {
      console.log(`Tentative de connexion ${providerType} depuis:`, window.location.hostname);
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Vérifier/Créer le document utilisateur dans Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Vérification stricte du rôle admin
        if (userData.userRole === "Admin") {
          // Mettre à jour la dernière connexion
          await setDoc(userDocRef, {
            lastLoginAt: serverTimestamp()
          }, { merge: true });

          const adminUserData = {
            uid: user.uid,
            email: user.email,
            name: user.displayName || userData.name || user.email,
            role: userData.userRole,
            profilePic: user.photoURL || userData.profilePic,
            lastLogin: new Date().toISOString()
          };
          
          localStorage.setItem('adminUser', JSON.stringify(adminUserData));
          
          toast.success(`Connecté en tant qu'administrateur avec ${providerType === 'google' ? 'Google' : 'GitHub'} !`);
          navigate("/");
        } else {
          await handleLogout();
          setDebugInfo(`Rôle détecté: ${userData.userRole}`);
          throw new Error(`Votre rôle: ${userData.userRole}. Accès réservé aux administrateurs.`);
        }
      } else {
        // Nouvel utilisateur - refuser l'accès automatique
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          name: user.displayName || "",
          profilePic: user.photoURL || "",
          createdAt: serverTimestamp(),
          userRole: "User",
          provider: providerType,
          lastLoginAttempt: serverTimestamp()
        });
        
        await handleLogout();
        setDebugInfo("Nouvel utilisateur - rôle User par défaut");
        throw new Error("Compte créé. Contactez un administrateur existant pour obtenir l'accès.");
      }

    } catch (error) {
      console.error(`Erreur détaillée ${providerType}:`, error);
      
      let errorMsg = `Échec de la connexion avec ${providerType === 'google' ? 'Google' : 'GitHub'}.`;
      let debugMsg = `Domaine: ${window.location.hostname}`;
      
      if (error?.code) {
        switch (error.code) {
          case 'auth/popup-closed-by-user':
            errorMsg = "La fenêtre de connexion a été fermée.";
            debugMsg += " | Popup fermé";
            break;
          case 'auth/account-exists-with-different-credential':
            errorMsg = "Un compte existe déjà avec un autre fournisseur d'authentification.";
            debugMsg += " | Compte existe avec autre provider";
            break;
          case 'auth/popup-blocked':
            errorMsg = "La fenêtre popup a été bloquée. Autorisez les popups pour ce site.";
            debugMsg += " | Popup bloqué";
            break;
          case 'auth/cancelled-popup-request':
            errorMsg = "La requête de popup a été annulée.";
            debugMsg += " | Popup annulé";
            break;
          case 'auth/unauthorized-domain':
            errorMsg = "Ce domaine n'est pas autorisé pour l'authentification.";
            debugMsg += " | DOMAINE NON AUTORISÉ - Ajoutez ce domaine dans Firebase Console";
            break;
          case 'auth/invalid-credential':
            errorMsg = "Identifiants invalides pour la connexion sociale.";
            debugMsg += " | Identifiants invalides";
            break;
          default:
            errorMsg = `Erreur ${providerType}: ${error.code}. ${error.message || "Veuillez réessayer."}`;
            debugMsg += ` | Code: ${error.code}`;
        }
      } else if (error?.message) {
        errorMsg = error.message;
      }
      
      setErrorMessage(errorMsg);
      setDebugInfo(debugMsg);
      toast.error(errorMsg);
    } finally {
      setSocialLoading(prev => ({ ...prev, [providerType]: false }));
    }
  };

  const isFormValid = email.length > 0 && password.length >= 6;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* En-tête */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl mb-6 border border-white/20">
            <Shield className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Panneau Administrateur</h1>
          <p className="text-gray-300">Accès réservé au personnel autorisé</p>
          <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30">
            <span className="text-xs text-red-300 font-medium">🔐 Accès Administrateur Seulement</span>
          </div>
          
          {/* Afficher le domaine actuel */}
          <div className="mt-4 inline-flex items-center px-3 py-2 bg-gray-800/50 rounded-lg">
            <Globe className="w-4 h-4 text-blue-400 mr-2" />
            <span className="text-xs text-gray-300">
              Domaine: <span className="font-mono text-white">{window.location.hostname}</span>
            </span>
          </div>
        </div>

        {/* Carte de connexion */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8">
          <form onSubmit={handleEmailLogin} className="space-y-6">
            {/* Message d'erreur */}
            {errorMessage && (
              <div className="space-y-3">
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                    <span className="font-medium text-sm">{errorMessage}</span>
                  </div>
                </div>
                
                {/* Informations de débogage */}
                {debugInfo && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 px-4 py-2 rounded-lg text-xs">
                    <div className="flex items-start">
                      <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="font-medium mb-1">Informations techniques:</p>
                        <p className="opacity-90">{debugInfo}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Guide spécifique pour unauthorized-domain */}
            {errorMessage.includes("Domaine non autorisé") && (
              <div className="bg-purple-500/10 border border-purple-500/30 text-purple-200 px-4 py-3 rounded-lg">
                <div className="flex items-start">
                  <Globe className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium mb-2">🔧 Solution nécessaire:</p>
                    <p className="text-sm mb-2">Le domaine <strong>{window.location.hostname}</strong> doit être ajouté dans Firebase Console.</p>
                    <div className="bg-black/30 p-3 rounded text-xs font-mono">
                      <p className="text-green-400">Étapes à suivre:</p>
                      <ol className="list-decimal pl-5 mt-2 space-y-1">
                        <li>Allez sur <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline">Firebase Console</a></li>
                        <li>Sélectionnez votre projet</li>
                        <li>Allez dans <strong>Authentication</strong> → <strong>Sign-in method</strong></li>
                        <li>Cliquez sur <strong>"Add domain"</strong></li>
                        <li>Ajoutez: <code className="bg-gray-800 px-2 py-1 rounded">{window.location.hostname}</code></li>
                        <li>Cliquez sur <strong>Save</strong></li>
                        <li>Attendez 1-2 minutes pour que les changements prennent effet</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Champ Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email Administrateur
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim())}
                  placeholder="admin@domaine.com"
                  className="block w-full pl-10 pr-3 py-3 bg-white/5 border border-gray-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 placeholder-gray-500 text-white disabled:opacity-50"
                  disabled={loading || socialLoading.google || socialLoading.github}
                  autoComplete="email"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Champ Mot de passe */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Mot de passe Administrateur
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-12 py-3 bg-white/5 border border-gray-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 placeholder-gray-500 text-white disabled:opacity-50"
                  disabled={loading || socialLoading.google || socialLoading.github}
                  autoComplete="current-password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center disabled:opacity-50"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading || socialLoading.google || socialLoading.github}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-300 transition" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-300 transition" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">Minimum 6 caractères</p>
            </div>

            {/* Bouton de connexion Email */}
            <button
              type="submit"
              disabled={loading || socialLoading.google || socialLoading.github || !isFormValid}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-500/25"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Vérification des accès...
                </>
              ) : (
                "Connexion Administrateur"
              )}
            </button>

            {/* Séparateur */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600/50"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-transparent text-gray-400">Ou avec un compte administrateur existant</span>
              </div>
            </div>

            {/* Boutons de connexion sociale */}
            <div className="grid grid-cols-2 gap-3">
              {/* Bouton Google */}
              <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                disabled={loading || socialLoading.google || socialLoading.github}
                className="w-full bg-white hover:bg-gray-50 text-gray-800 py-3 px-4 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {socialLoading.google ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </>
                )}
              </button>

              {/* Bouton GitHub */}
              <button
                type="button"
                onClick={() => handleSocialLogin('github')}
                disabled={loading || socialLoading.google || socialLoading.github}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 px-4 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {socialLoading.github ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  <>
                    <Github className="w-5 h-5 mr-2" />
                    GitHub
                  </>
                )}
              </button>
            </div>

            {/* Note de sécurité */}
            <div className="text-center pt-4 border-t border-gray-600/50">
              <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                <Shield className="w-3 h-3" />
                Seuls les utilisateurs avec rôle "Admin" peuvent accéder
              </p>
            </div>
          </form>
        </div>

        {/* Guide de configuration des domaines */}
        <div className="mt-6 bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <h3 className="text-sm font-medium text-white mb-2 flex items-center">
            <Globe className="w-4 h-4 mr-2 text-blue-400" />
            Configuration des domaines Firebase
          </h3>
          <div className="text-xs text-gray-300 space-y-2">
            <p className="flex items-start">
              <span className="text-green-400 mr-2">✓</span>
              <span>Domaine autorisé localement: <code className="bg-gray-900 px-2 py-1 rounded ml-1">localhost</code></span>
            </p>
            <p className="flex items-start">
              <span className="text-red-400 mr-2">✗</span>
              <span>Domaine à ajouter: <code className="bg-gray-900 px-2 py-1 rounded ml-1 font-bold">{window.location.hostname}</code></span>
            </p>
            <div className="mt-3 p-2 bg-black/30 rounded">
              <p className="font-medium text-blue-300 mb-1">Étapes rapides:</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Ouvrez Firebase Console → Authentication</li>
                <li>Cliquez sur "Sign-in method"</li>
                <li>Ajoutez votre domaine dans "Authorized domains"</li>
                <li>Cliquez "Save" et patientez 1-2 minutes</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Pied de page */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400">
            Problème de domaine ?{" "}
            <span className="font-medium text-blue-300 hover:text-blue-200 cursor-pointer transition">
              Suivez le guide ci-dessus
            </span>
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Panel Admin • Version 1.0 • Domaine: {window.location.hostname}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;