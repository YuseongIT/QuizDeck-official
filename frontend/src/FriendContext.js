import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from './api';
import { useAuth } from './AuthContext';

const FriendContext = createContext(null);

export function FriendProvider({ children }) {
  const { token } = useAuth();
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refreshFriends = useCallback(async () => {
    if (!token) return [];
    try {
      const list = await apiRequest('/api/friends', { token });
      setFriends(list || []);
      return list || [];
    } catch (e) {
      setError(e.message || 'Failed to load friends');
      return [];
    }
  }, [token]);

  const refreshRequests = useCallback(async () => {
    if (!token) return { incoming: [], outgoing: [] };
    try {
      const data = await apiRequest('/api/friends/requests', { token });
      const inc = data?.incoming_requests || [];
      const out = data?.outgoing_requests || [];
      setIncoming(inc);
      setOutgoing(out);
      return { incoming: inc, outgoing: out };
    } catch (e) {
      setError(e.message || 'Failed to load requests');
      return { incoming: [], outgoing: [] };
    }
  }, [token]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([refreshFriends(), refreshRequests()]);
    } finally {
      setLoading(false);
    }
  }, [refreshFriends, refreshRequests]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // When logged out, clear in-memory state to avoid stale cross-account data
  useEffect(() => {
    if (!token) {
      setFriends([]);
      setIncoming([]);
      setOutgoing([]);
      setError('');
      setLoading(false);
    }
  }, [token]);

  // Global event listeners to keep everything synced
  useEffect(() => {
    function onRequests() { bootstrap(); }
    function onFriendsUpdate(e) {
      if (e && e.detail && Array.isArray(e.detail.friends)) {
        setFriends(e.detail.friends);
      } else {
        refreshFriends();
      }
    }
    window.addEventListener('requests:update', onRequests);
    window.addEventListener('friends:update', onFriendsUpdate);
    return () => {
      window.removeEventListener('requests:update', onRequests);
      window.removeEventListener('friends:update', onFriendsUpdate);
    };
  }, [bootstrap, refreshFriends]);

  const value = useMemo(() => ({
    friends,
    incoming,
    outgoing,
    loading,
    error,
    setFriends,
    setIncoming,
    setOutgoing,
    refreshFriends,
    refreshRequests,
  }), [friends, incoming, outgoing, loading, error, refreshFriends, refreshRequests]);

  return (
    <FriendContext.Provider value={value}>
      {children}
    </FriendContext.Provider>
  );
}

export function useFriends() {
  const ctx = useContext(FriendContext);
  if (!ctx) throw new Error('useFriends must be used within FriendProvider');
  return ctx;
}
