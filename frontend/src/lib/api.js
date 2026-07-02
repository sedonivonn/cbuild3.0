// Thin axios wrapper that attaches the current Firebase ID token to every
// request. Falls back to unauthenticated calls when the user is signed out.

import axios from "axios";
import { getFirebase, isFirebaseConfigured } from "./firebase";

const BASE_URL = process.env.REACT_APP_BACKEND_URL || "";

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  try {
    if (!isFirebaseConfigured()) return config;
    const { auth } = getFirebase();
    const user = auth?.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (_) {
    // Non-fatal: send the request without an auth header.
  }
  return config;
});

export const publicApi = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15000,
});
