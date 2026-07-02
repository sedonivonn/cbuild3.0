// Firebase Web SDK bootstrap.
//
// The whole thing is guarded by `isFirebaseConfigured()` so the app still runs
// (with auth features disabled) when env vars are not yet filled in.

import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = () => {
  if (process.env.REACT_APP_AUTH_DISABLED === "true") return false;
  const required = [
    firebaseConfig.apiKey,
    firebaseConfig.authDomain,
    firebaseConfig.projectId,
    firebaseConfig.appId,
  ];
  return required.every((v) => typeof v === "string" && v.length > 0);
};

let _app = null;
let _auth = null;
let _db = null;
let _googleProvider = null;

export const getFirebase = () => {
  if (!isFirebaseConfigured()) return { app: null, auth: null, db: null, googleProvider: null };

  if (!_app) {
    _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    _auth = getAuth(_app);
    // Persist across reloads so the user stays logged in.
    setPersistence(_auth, browserLocalPersistence).catch(() => { /* ignore */ });
    _db = getFirestore(_app);
    _googleProvider = new GoogleAuthProvider();
    _googleProvider.setCustomParameters({ prompt: "select_account" });
  }

  return { app: _app, auth: _auth, db: _db, googleProvider: _googleProvider };
};
