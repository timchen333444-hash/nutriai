import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const TOKEN_KEY = 'nutriai_token';
const USER_KEY  = 'nutriai_user';

// ── Helpers ────────────────────────────────────────────────────────────────────

function readToken()  { return localStorage.getItem(TOKEN_KEY) || null; }

function readUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveToken(t)  { localStorage.setItem(TOKEN_KEY, t); }
function saveUser(u)   { try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch {} }

function clearStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── Synchronous boot-time setup ────────────────────────────────────────────────
// This runs at module evaluation time (before any component renders) so every
// axios call made by child components already has the correct base URL and header.

// Point all relative /api calls at the Railway backend in production.
// In development Vite's proxy handles /api → localhost:3001, so no baseURL is needed.
if (import.meta.env.VITE_API_URL) {
  axios.defaults.baseURL = import.meta.env.VITE_API_URL;
}

const _bootToken = readToken();
const _bootUser  = readUser();

if (_bootToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${_bootToken}`;
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  // Seed from cache immediately — user sees the app without waiting for the
  // /api/auth/me round-trip when they already have a valid session.
  const [user,    setUser]    = useState(_bootUser);
  const [token,   setToken]   = useState(_bootToken);

  // Only show the full-screen loading spinner when there IS a token but no
  // cached user yet (first install / cleared cache).  When we have a cached
  // user we render the app right away and verify in the background.
  const [loading, setLoading] = useState(!!_bootToken && !_bootUser);

  // ── Background token verification ────────────────────────────────────────────
  // Runs once on mount.  Refreshes the user object from the server if possible.
  useEffect(() => {
    if (!_bootToken) return;

    axios.get('/api/auth/me')
      .then((r) => {
        // Token is valid — update the cached user and reveal the app if still loading
        saveUser(r.data);
        setUser(r.data);
      })
      .catch((err) => {
        const status = err.response?.status;

        if (status === 401) {
          // Token is definitively rejected by the server → sign out.
          // Dispatch a custom event so AppRoutes (inside ToastProvider) can
          // show a friendly message before the redirect happens.
          window.dispatchEvent(new CustomEvent('auth:session-expired'));
          _clearSession();
        }
        // Any other failure (network error, 500, server restarting, offline)
        // is NOT a reason to sign the user out.  The cached user stays in place.
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Global 401 interceptor ───────────────────────────────────────────────────
  // If ANY API call returns 401 after login (token expired mid-session),
  // sign the user out and let them know.
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (response) => response,
      (err) => {
        if (err.response?.status === 401 && readToken()) {
          // A 401 while we believe we're logged in means the token is gone/invalid
          _clearSession();
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Internal clear helper ────────────────────────────────────────────────────
  // Not a state setter — just the shared cleanup. The React state setters are
  // called by the two callers above so they appear in this closure correctly.
  const _clearSession = () => {
    clearStorage();
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  };

  // ── Public API ───────────────────────────────────────────────────────────────

  const login = (newToken, userData) => {
    saveToken(newToken);
    saveUser(userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    _clearSession();
  };

  // updateUser is called by profile-save, onboarding, unit-settings etc.
  // It merges the delta into the current user and persists it.
  const updateUser = (data) => {
    setUser((prev) => {
      const next = prev ? { ...prev, ...data } : data;
      saveUser(next);
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
