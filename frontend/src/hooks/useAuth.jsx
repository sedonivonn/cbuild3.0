// AuthProvider + useAuth hook.
//
// Wraps the app with Firebase Auth state. When Firebase is not configured,
// `authAvailable` is false and every action becomes a soft no-op so the
// rest of the app keeps working with localStorage as before.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { getFirebase, isFirebaseConfigured } from "../lib/firebase";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const available = isFirebaseConfigured();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(available);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!available) {
      setLoading(false);
      return;
    }
    const { auth } = getFirebase();
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser || null);
      setLoading(false);
      if (fbUser) {
        // Best-effort sync to backend; ignore errors so UI never blocks.
        try {
          await api.post("/auth/sync");
        } catch (_) {
          /* backend or firebase-admin may not be ready yet */
        }
      }
    });
    return () => unsub();
  }, [available]);

  const withErr = useCallback(async (fn) => {
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(mapAuthError(e));
      throw e;
    }
  }, []);

  const registerEmail = useCallback(
    (email, password, displayName) =>
      withErr(async () => {
        const { auth } = getFirebase();
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
          await updateProfile(cred.user, { displayName });
        }
        return cred.user;
      }),
    [withErr]
  );

  const loginEmail = useCallback(
    (email, password) =>
      withErr(async () => {
        const { auth } = getFirebase();
        const cred = await signInWithEmailAndPassword(auth, email, password);
        return cred.user;
      }),
    [withErr]
  );

  const loginGoogle = useCallback(
    () =>
      withErr(async () => {
        const { auth, googleProvider } = getFirebase();
        const cred = await signInWithPopup(auth, googleProvider);
        return cred.user;
      }),
    [withErr]
  );

  const logout = useCallback(async () => {
    if (!available) return;
    const { auth } = getFirebase();
    await signOut(auth);
  }, [available]);

  const resetPassword = useCallback(
    (email) =>
      withErr(async () => {
        const { auth } = getFirebase();
        await sendPasswordResetEmail(auth, email);
      }),
    [withErr]
  );

  const value = useMemo(
    () => ({
      authAvailable: available,
      user,
      loading,
      error,
      clearError: () => setError(null),
      registerEmail,
      loginEmail,
      loginGoogle,
      logout,
      resetPassword,
    }),
    [available, user, loading, error, registerEmail, loginEmail, loginGoogle, logout, resetPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Safe fallback so components can be used before the provider mounts.
    return {
      authAvailable: false,
      user: null,
      loading: false,
      error: null,
      clearError: () => {},
      registerEmail: async () => null,
      loginEmail: async () => null,
      loginGoogle: async () => null,
      logout: async () => {},
      resetPassword: async () => {},
    };
  }
  return ctx;
};

// Translate Firebase error codes into short Turkish messages.
function mapAuthError(e) {
  const code = e?.code || "";
  switch (code) {
    case "auth/invalid-email":
      return "Geçersiz e-posta adresi.";
    case "auth/user-disabled":
      return "Bu hesap devre dışı bırakılmış.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "E-posta veya şifre hatalı.";
    case "auth/email-already-in-use":
      return "Bu e-posta zaten kayıtlı.";
    case "auth/weak-password":
      return "Şifre çok zayıf (en az 6 karakter).";
    case "auth/popup-closed-by-user":
      return "Google girişi iptal edildi.";
    case "auth/popup-blocked":
      return "Tarayıcı Google giriş penceresini engelledi.";
    case "auth/network-request-failed":
      return "Ağ hatası. İnternet bağlantını kontrol et.";
    default:
      return e?.message || "Bir hata oluştu.";
  }
}
