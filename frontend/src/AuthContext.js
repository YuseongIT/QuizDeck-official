import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from './api';

// Determine a session scope for auth storage:
// 1) If URL has ?session=<id>, use that.
// 2) Else, use a per-tab id stored in sessionStorage (persists for this tab only).
function getSessionId() {
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get('session');
    if (q && q.trim()) return q.trim();
  } catch (_) {}
  try {
    const KEY = 'qd_session_id';
    let sid = sessionStorage.getItem(KEY);
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(KEY, sid);
    }
    return sid;
  } catch (_) {
    // Fallback to a stable but shared scope if sessionStorage is unavailable
    return 'default';
  }
}

function nsKey(base, sid) { return `${base}:${sid}`; }

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const sessionId = useMemo(() => getSessionId(), []);
  const [token, setToken] = useState(() => {
    try {
      const namespaced = localStorage.getItem(nsKey('qd_token', sessionId));
      if (namespaced) return namespaced;
      // Migrate from global key on first load of this tab/session
      const legacy = localStorage.getItem('qd_token');
      if (legacy) {
        localStorage.setItem(nsKey('qd_token', sessionId), legacy);
        return legacy;
      }
    } catch (_) {}
    return null;
  });
  const [user, setUser] = useState(() => {
    try {
      const namespaced = localStorage.getItem(nsKey('qd_user', sessionId));
      if (namespaced) return JSON.parse(namespaced);
      const legacy = localStorage.getItem('qd_user');
      if (legacy) {
        localStorage.setItem(nsKey('qd_user', sessionId), legacy);
        return JSON.parse(legacy);
      }
    } catch (_) { /* ignore */ }
    return null;
  });

  useEffect(() => {
    const key = nsKey('qd_token', sessionId);
    if (token) localStorage.setItem(key, token); else localStorage.removeItem(key);
  }, [token, sessionId]);
  useEffect(() => {
    const key = nsKey('qd_user', sessionId);
    if (user) localStorage.setItem(key, JSON.stringify(user)); else localStorage.removeItem(key);
  }, [user, sessionId]);

  // Hydrate user from server on startup or when token changes to keep user fields (including profile_image) persistent
  useEffect(() => {
    let abort = false;
    async function hydrate() {
      if (!token) return;
      try {
        const data = await apiRequest('/api/me', { token });
        const srvUser = data && (data.user || data);
        if (!abort && srvUser) {
          setUser(prev => ({ ...(prev || {}), ...srvUser }));
        }
      } catch (_) {}
    }
    if (token) hydrate();
    return () => { abort = true; };
  }, [token]);

  // Handle verification redirect parameters, e.g. /settings?verified=1 or 0&reason=expired
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const v = url.searchParams.get('verified');
      const reason = url.searchParams.get('reason');
      if (v === '1') {
        // Optimistically set verified flag and notify
        setUser(prev => (prev ? { ...prev, is_verified: true } : prev));
        try { sessionStorage.setItem('qd_verified_just_now', '1'); } catch(_) {}
        window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: "You're officially verified! 🥳 Thanks for confirming your account." } }));
        // Remove query params from URL without reloading
        url.searchParams.delete('verified');
        url.searchParams.delete('reason');
        window.history.replaceState({}, '', url.pathname + (url.search ? '?' + url.searchParams.toString() : '') + url.hash);
      } else if (v === '0') {
        const msg = reason === 'expired'
          ? "Oops! 😅 That link’s a little too old. Try sending a fresh one!"
          : "Verification link invalid. Please request a new one.";
        window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: msg } }));
        url.searchParams.delete('verified');
        url.searchParams.delete('reason');
        window.history.replaceState({}, '', url.pathname + (url.search ? '?' + url.searchParams.toString() : '') + url.hash);
      }
    } catch (_) { /* ignore */ }
  }, []);

  const signup = async ({ username, email, password, role }) => {
    const data = await apiRequest('/api/signup', { method: 'POST', body: { username, email, password, role } });
    return data;
  };

  const login = async ({ email, password, role }) => {
    const data = await apiRequest('/api/login', { method: 'POST', body: { email, password, role } });
    setToken(data.token);
    setUser(data.user);
    try {
      const sid = sessionId;
      const studentMyKey = `qd:cache:student:myCourses:${sid}`;
      const discoverKey = `qd:cache:courses:discover:${sid}:`;
      const teacherCoursesKey = `qd:cache:teacher:courses:${sid}`;
      // Fire-and-forget prefetches; ignore errors
      (async () => {
        try { await apiRequest('/api/dashboard', { token: data.token }); } catch(_) {}
        try { await apiRequest('/api/quizzes', { token: data.token }); } catch(_) {}
        try {
          const mine = await apiRequest('/api/me/courses', { token: data.token });
          try { localStorage.setItem(studentMyKey, JSON.stringify(Array.isArray(mine) ? mine : [])); } catch(_) {}
        } catch(_) {}
        try {
          const pub = await apiRequest('/api/courses/public', { token: data.token });
          try { localStorage.setItem(discoverKey, JSON.stringify(Array.isArray(pub) ? pub : [])); } catch(_) {}
        } catch(_) {}
        try {
          const tc = await apiRequest('/api/courses', { token: data.token });
          try { localStorage.setItem(teacherCoursesKey, JSON.stringify(Array.isArray(tc) ? tc : [])); } catch(_) {}
        } catch(_) {}
      })();
    } catch(_) {}
    return data;
  };

  const logout = async () => {
    try { await apiRequest('/api/logout', { method: 'POST', token }); } catch (_) {}
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ token, user, setUser, signup, login, logout, isAuthenticated: !!token }), [token, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
