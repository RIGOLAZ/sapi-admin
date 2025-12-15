import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, GithubAuthProvider } from "firebase/auth";
import { auth, db } from '../firebase/config';
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "react-toastify";
import { Mail, Lock, Loader2, Eye, EyeOff, Github } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState({ google: false, github: false });
  const navigate = useNavigate();

  // Vérifier si le formulaire est valide
  useEffect(() => {
    const isValid = email.length > 0 && password.length >= 6;
  }, [email, password]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Veuillez saisir un email et un mot de passe.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Vérifier le rôle admin dans Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.userRole === "Admin") {
          toast.success("Connexion réussie !");
          localStorage.setItem('adminUser', JSON.stringify({
            uid: user.uid,
            email: user.email,
            name: userData.name,
            role: userData.userRole
          }));
          navigate("/");
        } else {
          await auth.signOut();
          setErrorMessage("Accès refusé. Privilèges administrateur requis.");
          toast.error("Accès refusé.");
        }
      } else {
        await auth.signOut();
        setErrorMessage("Compte utilisateur non trouvé.");
        toast.error("Compte non trouvé.");
      }
    } catch (error) {
      console.error("Erreur de connexion:", error);
      let errorMsg = "Échec de la connexion.";
      switch (error.code) {
        case 'auth/invalid-email': errorMsg = "Email invalide."; break;
        case 'auth/user-not-found': errorMsg = "Aucun compte avec cet email."; break;
        case 'auth/wrong-password': errorMsg = "Mot de passe incorrect."; break;
        case 'auth/too-many-requests': errorMsg = "Trop de tentatives. Réessayez plus tard."; break;
      }
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (providerType) => {
    setSocialLoading(prev => ({ ...prev, [providerType]: true }));
    setErrorMessage("");

    // Créer le fournisseur d'authentification
    const provider = providerType === 'google' ? new GoogleAuthProvider() : new GithubAuthProvider();

    // Optionnel : ajouter des paramètres ou des scopes
    if (providerType === 'github') {
      provider.addScope('user:email');
    }

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Vérifier/Créer le document utilisateur dans Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.userRole !== "Admin") {
          await auth.signOut();
          throw new Error("Cet utilisateur n'a pas les privilèges administrateur.");
        }
      } else {
        // Si nouvel utilisateur, le créer avec un rôle par défaut (non-admin)
        // Un super-admin devra ensuite lui attribuer manuellement le rôle "Admin"
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          name: user.displayName || "",
          profilePic: user.photoURL || "",
          createdAt: new Date().toISOString(),
          userRole: "User" // Par défaut, pas admin
        });
        await auth.signOut();
        throw new Error("Compte créé. Contactez un administrateur pour obtenir l'accès.");
      }

      // Connexion réussie pour un admin
      toast.success(`Connecté avec ${providerType === 'google' ? 'Google' : 'GitHub'} !`);
      localStorage.setItem('adminUser', JSON.stringify({
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        role: "Admin"
      }));
      navigate("/");

    } catch (error) {
      console.error(`Erreur ${providerType}:`, error);
      const errorMsg = error.message || `Échec de la connexion avec ${providerType === 'google' ? 'Google' : 'GitHub'}.`;
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSocialLoading(prev => ({ ...prev, [providerType]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* En-tête */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl mb-6 border border-white/20">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Espace Administrateur</h1>
          <p className="text-gray-300">Accédez au panneau de gestion</p>
        </div>

        {/* Carte de connexion */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8">
          <form onSubmit={handleEmailLogin} className="space-y-6">
            {/* Message d'erreur */}
            {errorMessage && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Champ Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Adresse Email
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
                  placeholder="admin@votre-domaine.com"
                  className="block w-full pl-10 pr-3 py-3 bg-white/5 border border-gray-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 placeholder-gray-500 text-white"
                  disabled={loading || socialLoading.google || socialLoading.github}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Champ Mot de passe */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Mot de passe
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
                  className="block w-full pl-10 pr-12 py-3 bg-white/5 border border-gray-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 placeholder-gray-500 text-white"
                  disabled={loading || socialLoading.google || socialLoading.github}
                  autoComplete="current-password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading || socialLoading.google || socialLoading.github}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                  )}
                </button>
              </div>
            </div>

            {/* Bouton de connexion Email */}
            <button
              type="submit"
              disabled={loading || socialLoading.google || socialLoading.github || !email || !password}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Connexion...
                </>
              ) : (
                "Se connecter"
              )}
            </button>

            {/* Séparateur */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600/50"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-transparent text-gray-400">Ou continuer avec</span>
              </div>
            </div>

            {/* Boutons de connexion sociale */}
            <div className="grid grid-cols-2 gap-3">
              {/* Bouton Google */}
              <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                disabled={loading || socialLoading.google || socialLoading.github}
                className="w-full bg-white text-gray-800 py-3 px-4 rounded-lg font-medium hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
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
              <p className="text-xs text-gray-400">
                🔒 Accès sécurisé. Toutes les actions sont journalisées.
              </p>
            </div>
          </form>
        </div>

        {/* Pied de page */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400">
            Problème de connexion ?{" "}
                <span className="font-medium text-white">Contactez le support technique</span>
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Panel Admin • Version 1.0 • Protégé par Firebase
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;