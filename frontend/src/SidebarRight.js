import React, { useEffect, useMemo, useRef, useState } from 'react';
import { sidebarStyles, theme } from './theme';
import { useAuth } from './AuthContext';
import { apiRequest, toImageUrl, API_BASE } from './api';
import { useNavigate } from 'react-router-dom';
import UserProfileModal from './UserProfileModal';
import { useFriends } from './FriendContext';

const SidebarRight = ({ isOpen }) => {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const { friends, incoming, outgoing, loading, error, setFriends, setIncoming, refreshFriends, refreshRequests } = useFriends();
    const [profileUser, setProfileUser] = useState('');
    const [confirm, setConfirm] = useState({ type: '', request: null });
    // Search state
    const [q, setQ] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [activeIdx, setActiveIdx] = useState(-1);
    const combinedStyle = {
        ...sidebarStyles.base,
        ...sidebarStyles.rightClosed,
        ...(isOpen ? sidebarStyles.rightOpen : {}),
        backgroundColor: '#8a60c0',
        color: 'white',
        paddingLeft: 18,
        paddingRight: 18,
        paddingBottom: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: '26px',
        boxSizing: 'border-box',
        width: '370px',
        maxWidth: '92vw',
    };

    const quizCardBase = {
        borderRadius: '8px',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '0.9em',
        textAlign: 'center',
        cursor: 'pointer',
        border: 'none',
        width: '100%',
    };

    const quizCardText = {
        padding: '10px 14px',
        margin: '0',
    };

    const [myImage, setMyImage] = useState(user?.profile_image || null);

    useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                if (!token) return;
                const results = await Promise.allSettled([
                  refreshFriends(),
                  refreshRequests(),
                  apiRequest('/api/profile', { token }),
                ]);
                if (!mounted) return;
                const meRes = results[2];
                if (meRes.status === 'fulfilled' && meRes.value && meRes.value.profile_image) {
                  const raw = meRes.value.profile_image;
                  const abs = toImageUrl(raw);
                  setMyImage(abs);
                }
            } catch (e) {
                // ignore: context handles error display
            } finally {
                // context manages loading
            }
        }
        if (token) load();
        function onRequests(){ load(); }
        function onFriends(e){
          if (e && e.detail && Array.isArray(e.detail.friends)) setFriends(e.detail.friends);
          load();
        }
        function onProfile(e){
          if (e && e.detail && e.detail.profile_image) setMyImage(toImageUrl(e.detail.profile_image));
          load();
        }
        // seed current image
        setMyImage(user?.profile_image ? toImageUrl(user.profile_image) : null);
        window.addEventListener('requests:update', onRequests);
        window.addEventListener('friends:update', onFriends);
        window.addEventListener('profile:update', onProfile);
        return () => { mounted = false; window.removeEventListener('requests:update', onRequests); window.removeEventListener('friends:update', onFriends); window.removeEventListener('profile:update', onProfile); };
    }, [token, user?.profile_image]);

    // Debounced search
    useEffect(() => {
        let abort = false;
        const h = setTimeout(async () => {
            const term = (q || '').trim();
            if (!term) { setResults([]); return; }
            setSearching(true);
            try {
                const res = await apiRequest(`/api/friends/search?username=${encodeURIComponent(term)}`, { token });
                if (!abort) setResults(res?.data || []);
            } catch (_) {
                if (!abort) setResults([]);
            } finally {
                if (!abort) setSearching(false);
            }
        }, 300);
        return () => { abort = true; clearTimeout(h); };
    }, [q, token]);

    // legacy Add Friend flow removed in favor of integrated search

    async function accept(fr) {
        try {
            const other = fr.user_id === user?.id ? fr.friend : fr.user;
            const updated = await apiRequest(`/api/friends/accept/${other.username}`, { method: 'POST', token });
            setFriends(prev => prev.map(f => f.id === fr.id ? updated : f));
            try { window.dispatchEvent(new CustomEvent('friends:update', { detail: { friends: await apiRequest('/api/friends', { token }) } })); } catch(_) {}
        } catch (e) { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to accept' } })); }
    }

    async function remove(fr) {
        try {
            await apiRequest(`/api/friends/${fr.id}`, { method: 'DELETE', token });
            setFriends(prev => prev.filter(f => f.id !== fr.id));
            try { window.dispatchEvent(new CustomEvent('friends:update', { detail: { friends: await apiRequest('/api/friends', { token }) } })); } catch(_) {}
        } catch (e) { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to remove' } })); }
    }

    async function acceptRequest(req) {
        // optimistic remove
        setIncoming(prev => prev.filter(r => r.id !== req.id));
        try {
            if (req.source === 'legacy' && req.friend_row_id) {
                await apiRequest(`/api/friends/${req.friend_row_id}`, { method: 'PUT', token, body: { status: 'accepted' } });
            } else {
                const res = await apiRequest('/api/friends/accept', { method: 'POST', token, body: { request_id: req.id } });
                if (res && res.friends) setFriends(res.friends);
            }
            // notify others
            window.dispatchEvent(new CustomEvent('requests:update'));
            window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Friend request accepted.' }}));
            // Ensure lists are fresh
            try { const fresh = await apiRequest('/api/friends', { token }); setFriends(fresh || []); window.dispatchEvent(new CustomEvent('friends:update', { detail: { friends: fresh || [] } })); } catch (_) {}
        } catch (e) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to accept' } }));
            // rollback
            setIncoming(prev => [req, ...prev]);
            window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to accept request.' }}));
        }
    }

    async function rejectRequest(req) {
        // optimistic remove
        setIncoming(prev => prev.filter(r => r.id !== req.id));
        try {
            if (req.source === 'legacy' && req.friend_row_id) {
                await apiRequest(`/api/friends/${req.friend_row_id}`, { method: 'DELETE', token });
            } else {
                const res = await apiRequest('/api/friends/reject', { method: 'POST', token, body: { request_id: req.id } });
                if (res && res.friends) setFriends(res.friends);
            }
            window.dispatchEvent(new CustomEvent('requests:update'));
            window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Friend request rejected.' }}));
            try { const fresh = await apiRequest('/api/friends', { token }); setFriends(fresh || []); window.dispatchEvent(new CustomEvent('friends:update', { detail: { friends: fresh || [] } })); } catch (_) {}
        } catch (e) {
            window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to reject' } }));
            // rollback
            setIncoming(prev => [req, ...prev]);
            window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to reject request.' }}));
        }
    }

    // Derive a reliable user id; call /api/me at most once if missing
    const [effectiveId, setEffectiveId] = useState(() => Number((user?.userID ?? user?.id) || 0));
    const meFetchedOnce = useRef(false);
    useEffect(() => {
      const uid = Number((user?.userID ?? user?.id) || 0);
      if (Number.isFinite(uid) && uid > 0) {
        setEffectiveId(uid);
        meFetchedOnce.current = true; // no need to fetch /api/me
      } else if (token && !meFetchedOnce.current) {
        meFetchedOnce.current = true;
        (async () => {
          try {
            try { console.log('[SR/ME] fetching /api/me to hydrate id'); } catch(_) {}
            const data = await apiRequest('/api/me', { token });
            const u = (data && (data.user || data)) || {};
            const idn = Number(u?.id || 0);
            if (Number.isFinite(idn) && idn > 0) { setEffectiveId(idn); try { console.log('[SR/ME] hydrated id', { id: idn }); } catch(_) {} }
            else {
              try { console.log('[SR/ME] response without id', { data: u }); } catch(_) {}
              // Fallback: try /api/profile which should return the authenticated user with id
              try {
                console.log('[SR/PROFILE] fetching /api/profile to hydrate id');
                const prof = await apiRequest('/api/profile', { token });
                const pid = Number((prof && (prof.id || (prof.user && prof.user.id))) || 0);
                if (Number.isFinite(pid) && pid > 0) {
                  setEffectiveId(pid);
                  console.log('[SR/PROFILE] hydrated id', { id: pid });
                } else {
                  console.log('[SR/PROFILE] response without id', { prof });
                }
              } catch (e) { try { console.log('[SR/PROFILE] error', e?.message); } catch(_) {} }
            }
          } catch (_) { /* ignore */ }
        })();
      }
    }, [user?.id, token]);
    const currentId = Number(effectiveId || 0);
    const accepted = friends.filter(f => f.status === 'accepted');
    const pendings = friends.filter(f => f.status === 'pending');

    // Build a clean accepted list from related user objects only (robust and simple)
    const authReady = Number.isFinite(currentId) && currentId > 0 && !!token;
    const acceptedUsersRaw = authReady
      ? accepted.flatMap(fr => [fr.user, fr.friend].filter(Boolean))
          .filter(u => Number(u?.id) !== currentId)
      : [];
    const seen = new Set();
    const acceptedUsers = [];
    for (const u of acceptedUsersRaw) {
      const oid = Number(u.id);
      if (!Number.isFinite(oid) || seen.has(oid)) continue;
      seen.add(oid);
      acceptedUsers.push(u);
    }

    const [ownFriendsUsers, setOwnFriendsUsers] = useState([]);
    const [friendsLoading, setFriendsLoading] = useState(false);

    // Diagnostics: log auth readiness transitions
    useEffect(() => {
      try {
        console.log('[SR/Auth]', { token: !!token, currentId, authReady });
      } catch(_) {}
    }, [token, currentId, authReady]);

    // Direct source of truth: fetch current user's friends from API and build counterpart user list
    useEffect(() => {
      let cancelled = false;
      async function loadOwnFriends() {
        if (!authReady) { try { console.log('[SR/Friends] skip: auth not ready', { token: !!token, currentId }); } catch(_) {} return; }
        setFriendsLoading(true);
        try {
          const uidNow = Number(currentId || 0);
          try { console.log('[SR/Friends] fetch start', { uidNow, base: API_BASE }); } catch(_) {}
          // Primary: by current user id (richer relations)
          let data = await apiRequest(`/api/friends/${uidNow}`, { token });
          let rows = (data && Array.isArray(data.friends)) ? data.friends : [];
          // If API returns unexpected shape, fallback to generic list
          if (!rows.length) {
            const data2 = await apiRequest('/api/friends', { token });
            rows = Array.isArray(data2) ? data2 : [];
          }
          try { console.log('[FriendsDiag3] base=', API_BASE, 'uidNow=', uidNow, 'rows=', rows.length); } catch(_) {}
          const dd = new Set();
          const list = [];
          for (const fr of rows) {
            // include if accepted or status missing (backend variance tolerant)
            const st = String(fr.status || '').toLowerCase();
            if (st && st !== 'accepted') continue;
            const uid = Number(fr.user_id), fid = Number(fr.friend_id);
            const otherId = (uid === uidNow) ? fid : (fid === uidNow ? uid : (Number(fr.friend?.id) || Number(fr.user?.id)));
            let other = (uid === uidNow) ? fr.friend : (fid === uidNow ? fr.user : (fr.friend || fr.user));
            const idn = Number(other?.id || otherId);
            if (!Number.isFinite(idn) || idn === uidNow || dd.has(idn)) continue;
            // When relation missing, create minimal placeholder; UI will still render and allow View/Remove
            if (!other || typeof other !== 'object') other = { id: idn, username: (fr.username || '') };
            // ensure id is set numerically
            other = { ...other, id: idn };
            dd.add(idn); list.push(other);
          }
          try { console.log('[SR/Friends] mapped', { list: list.map(u => ({ id: u.id, username: u.username })) }); } catch(_) {}
          if (!cancelled) setOwnFriendsUsers(list);
        } catch (_) {
          try { console.log('[SR/Friends] error during fetch'); } catch(_) {}
          if (!cancelled) setOwnFriendsUsers([]);
        } finally {
          if (!cancelled) setFriendsLoading(false);
        }
      }
      loadOwnFriends();
      function onUpdate() { try { console.log('[SR/Friends] event-triggered refresh'); } catch(_) {} if (authReady) loadOwnFriends(); }
      window.addEventListener('friends:update', onUpdate);
      window.addEventListener('requests:update', onUpdate);
      return () => { cancelled = true; window.removeEventListener('friends:update', onUpdate); window.removeEventListener('requests:update', onUpdate); };
    }, [authReady, currentId, token]);

    // Ensure FriendContext list is hydrated on mount when auth is ready (used for request buttons state)
    useEffect(() => { if (authReady) { try { refreshFriends(); } catch(_) {} } }, [authReady, refreshFriends]);

    // Remove previous fallback logic: ownFriendsUsers is our exclusive source
    // One-time diagnostic: log mapping details to debug misrendering
    try {
      if (authReady && !window.__sidebar_friend_diag__) {
        window.__sidebar_friend_diag__ = true;
        // Log minimal, privacy-safe snapshot
        console.log('[FriendsDiag] currentId=', currentId,
          '\nraw accepted count=', accepted.length,
          '\nfirst raw row=', accepted[0] ? { id: accepted[0].id, user_id: accepted[0].user_id, friend_id: accepted[0].friend_id, has_user: !!accepted[0].user, has_friend: !!accepted[0].friend, user:{ id: accepted[0]?.user?.id, username: accepted[0]?.user?.username }, friend:{ id: accepted[0]?.friend?.id, username: accepted[0]?.friend?.username } } : null,
          '\nacceptedUsers mapped=', acceptedUsers.map(u => ({ id: u.id, username: u.username }))
        );
      }
    } catch (_) {}
    // Helpers to prevent duplicate requests
    // Strict source: only use our API-fetched own friends list
    const renderUsers = ownFriendsUsers || [];
    const acceptedIds = new Set(renderUsers.map(u => Number(u.id)).filter(v => Number.isFinite(v)));
    const pendingOutgoingIds = new Set((outgoing || []).map(r => Number(r.receiver_id)).filter(v => Number.isFinite(v)));
    const pendingIncomingIds = new Set((incoming || []).map(r => Number(r.sender_id)).filter(v => Number.isFinite(v)));
    const isFriendsWith = (id) => acceptedIds.has(id);
    const isPendingWith = (id) => pendingOutgoingIds.has(id) || pendingIncomingIds.has(id);

    return (
        <aside style={combinedStyle}>

            <div style={{ textAlign: 'center', padding: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: '10px' }}>
                <div style={{
                    backgroundColor: '#5c3b9b',
                    color: '#ffffff',
                    padding: '12px 22px',
                    border: '2px solid #2d1c3f',
                    borderRadius: '6px',
                    cursor: 'default',
                    fontWeight: 800,
                    fontSize: '1.22rem',
                    letterSpacing: 0.5,
                    width: '80%',
                    margin: '0 auto',
                    boxShadow: '0 6px 0 rgba(0,0,0,0.25)'
                }}>PROFILE</div>

                <div style={{ margin: '0 auto', width: '132px', height: '132px', backgroundColor: '#ffffff', borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px solid #2d1c3f', overflow: 'hidden' }}>
                    { (myImage || (user?.profile_image ? toImageUrl(user.profile_image) : '')) ? (
                      <img
                        src={(myImage ? toImageUrl(myImage) : toImageUrl(user.profile_image))}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={() => { /* drop state to trigger emoji */ setMyImage(null); }}
                      />
                    ) : (
                      <span style={{ fontSize: '52px', color: '#6a3ecb', fontWeight: 800, fontFamily: 'Kodchasan, sans-serif' }}>{(user?.username || 'U').charAt(0).toUpperCase()}</span>
                    )}
                </div>

            {/* Removed top-level search; moved into Friends card below */}

                <div style={{
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '1.45rem',
                    letterSpacing: 0.2,
                    marginTop: 4,
                    fontFamily: 'Kodchasan, Roboto, "Helvetica Neue", Arial, sans-serif'
                }}>
                    Welcome to QuizDeck!
                </div>

                <button onClick={() => navigate('/profile')} style={{
                    backgroundColor: '#ffae0b',
                    color: '#ffffff',
                    padding: '12px 20px',
                    borderRadius: '6px',
                    border: '2px solid #2d1c3f',
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: '1.38rem',
                    width: '88%',
                    boxShadow: '0 6px 0 rgba(0,0,0,0.25)',
                    transition: 'transform .12s ease, box-shadow .12s ease, background-color .12s ease'
                }}
                onMouseEnter={(e)=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 8px 0 rgba(0,0,0,0.3)'; e.currentTarget.style.backgroundColor='#e89d06'; }}
                onMouseLeave={(e)=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 6px 0 rgba(0,0,0,0.25)'; e.currentTarget.style.backgroundColor='#ffae0b'; }}>
                    <span style={{ fontFamily: 'Kodchasan, sans-serif' }}>
                      {(user && user.username) ? user.username.toUpperCase() : 'USER'}
                    </span>
                    {user?.is_verified && (
                      <span title="Verified" style={{ marginLeft: 8, filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.2))' }}>✅</span>
                    )}
                </button>
            </div>
            
            <div style={{ margin: '6px 0' }}></div>

            <div style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {error && !authReady && (
                  <div style={{ background: '#fdecea', color: '#611a15', padding: 8, borderRadius: 6 }}>{error}</div>
                )}

                {loading ? (
                    <div className="loader-container" style={{ height: 120 }}>
                        <div className="loader"></div>
                        <div className="loader-text">Loading...</div>
                    </div>
                ) : (
                    <>
                      {incoming.length > 0 && (
                        <div style={{ background: '#fff', color: '#333', borderRadius: 10, padding: 12 }}>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>Requests</div>
                          {incoming.map(req => {
                            const other = req.sender || {};
                            return (
                              <div key={req.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0', borderTop: '1px solid rgba(0,0,0,0.08)', transition: 'transform .12s ease, box-shadow .12s ease' }}
                                   onMouseEnter={(e)=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 3px 0 rgba(0,0,0,0.15)'; }}
                                   onMouseLeave={(e)=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}
                              >
                                <div onClick={() => setProfileUser(other?.username)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', background: '#f5f5f5', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {other?.profile_image ? <img src={toImageUrl(other.profile_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>👤</span>}
                                  </div>
                                  <span style={{ fontWeight: 700 }}>{other?.username}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <button onClick={() => setConfirm({ type: 'accept', request: req })} style={{ background: '#12af59', color: '#fff', border: 'none', padding: '10px 12px', borderRadius: 10, fontWeight: 800, width: '100%', transition: 'transform .12s ease, box-shadow .12s ease' }} onMouseEnter={(e)=>{e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 3px 0 rgba(0,0,0,0.2)';}} onMouseLeave={(e)=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none';}}>Accept</button>
                                  <button onClick={() => setConfirm({ type: 'reject', request: req })} style={{ background: '#e53935', color: '#fff', border: 'none', padding: '10px 12px', borderRadius: 10, fontWeight: 800, width: '100%', transition: 'transform .12s ease, box-shadow .12s ease' }} onMouseEnter={(e)=>{e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 3px 0 rgba(0,0,0,0.2)';}} onMouseLeave={(e)=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none';}}>Reject</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div style={{ background: '#fff', color: '#333', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, color: '#6a3ecb', marginBottom: 6, fontFamily: 'Kodchasan, sans-serif' }}>Find Users</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            value={q}
                            onChange={(e) => { setQ(e.target.value); setActiveIdx(-1); }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { if (results[0]) { setProfileUser(results[0].username); return; } }
                              if (!results.length) return;
                              if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => (i + 1) % results.length); }
                              if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => (i - 1 + results.length) % results.length); }
                              if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); setProfileUser(results[activeIdx].username); }
                            }}
                            placeholder="Search by username…"
                            style={{ flex: 1, width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', outline: 'none', boxShadow: '0 2px 0 rgba(0,0,0,0.06)', boxSizing: 'border-box', fontFamily: 'Kodchasan, sans-serif' }}
                          />
                          <button
                            onClick={() => { if (results[0]) setProfileUser(results[0].username); }}
                            style={{ background: '#ffae0b', color: '#000', border: '2px solid #2d1c3f', padding: '10px 12px', borderRadius: 10, fontWeight: 800, fontFamily: 'Kodchasan, sans-serif', boxShadow: '0 4px 0 rgba(0,0,0,0.2)', transition: 'transform .12s ease, box-shadow .12s ease, background-color .12s ease' }}
                            onMouseEnter={(e)=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 0 rgba(0,0,0,0.25)'; e.currentTarget.style.background='#e89d06'; }}
                            onMouseLeave={(e)=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 0 rgba(0,0,0,0.2)'; e.currentTarget.style.background='#ffae0b'; }}
                          >Search</button>
                        </div>
                        {searching && (
                          <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                            {[0,1,2].map(i => (
                              <div key={i} style={{ height: 44, borderRadius: 8, background: 'linear-gradient(90deg,#eee,#f7f7f7,#eee)', backgroundSize: '200% 100%', animation: 'qd-skel 1.2s ease-in-out infinite' }} />
                            ))}
                            <style>{`@keyframes qd-skel { 0%{background-position:0% 0} 100%{background-position:200% 0} }`}</style>
                          </div>
                        )}
                        {!searching && q.trim() && results.length === 0 && (
                          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>No results for "{q.trim()}"</div>
                        )}
                        {!searching && results.length > 0 && (
                          <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                            {results.map((u,idx) => (
                              <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: idx===activeIdx ? '#f2ecff' : '#fff', color: '#333', borderRadius: 8, padding: 8, transition: 'transform .12s ease, box-shadow .12s ease' }}
                                onMouseEnter={(e)=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 4px 0 rgba(0,0,0,0.2)'; setActiveIdx(idx); }}
                                onMouseLeave={(e)=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}
                              >
                                <div onClick={() => setProfileUser(u.username)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                  <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', background: '#f5f5f5', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#6a3ecb', fontFamily: 'Kodchasan, sans-serif' }}>
                                    {u.profile_image ? <img src={toImageUrl(u.profile_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ((u.username || 'U').charAt(0).toUpperCase())}
                                  </div>
                                  <div style={{ fontWeight: 700, fontFamily: 'Kodchasan, sans-serif' }}>{u.username}</div>
                                </div>
                                <button
                                  disabled={isFriendsWith(u.id) || isPendingWith(u.id)}
                                  onClick={async () => {
                                    try {
                                      await apiRequest('/api/friends/request', { method: 'POST', token, body: { receiver_id: u.id } });
                                      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Friend request sent.' } }));
                                      await Promise.all([refreshRequests(), refreshFriends()]);
                                      setQ(''); setResults([]);
                                      window.dispatchEvent(new CustomEvent('requests:update'));
                                    } catch (e) {
                                      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to send request' } }));
                                    }
                                  }}
                                  style={{ background: '#ffae0b', color: '#000', border: '2px solid #2d1c3f', padding: '8px 10px', borderRadius: 10, fontWeight: 800, transition: 'transform .12s ease, box-shadow .12s ease', fontFamily: 'Kodchasan, sans-serif', opacity: (isFriendsWith(u.id) || isPendingWith(u.id)) ? 0.6 : 1, boxShadow: '0 4px 0 rgba(0,0,0,0.2)'}}
                                  onMouseEnter={(e)=>{e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 0 rgba(0,0,0,0.25)';}}
                                  onMouseLeave={(e)=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 0 rgba(0,0,0,0.2)';}}
                                >{isFriendsWith(u.id) ? 'Friends' : isPendingWith(u.id) ? 'Pending' : 'Add'}</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ background: '#fff', color: '#333', borderRadius: 10, padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Kodchasan, sans-serif', color: '#6a3ecb' }}>Friends</div>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>{renderUsers.length} total</div>
                        </div>
                        {friendsLoading && (
                          <div style={{ opacity: 0.9, padding: '12px 0', textAlign: 'center', fontFamily: 'Kodchasan, sans-serif' }}>
                            <div style={{ fontSize: 14, color: '#6a3ecb', fontWeight: 700 }}>Loading friends…</div>
                          </div>
                        )}
                        {authReady && !friendsLoading && renderUsers.length === 0 && (
                          <div style={{ opacity: 0.9, padding: '12px 0', textAlign: 'center', fontFamily: 'Kodchasan, sans-serif' }}>
                            <div style={{ fontSize: 16, marginBottom: 4, color: '#6a3ecb', fontWeight: 700 }}>No friends yet</div>
                            <div style={{ fontSize: 13, color: '#ff4fa3' }}>Try searching for users to connect.</div>
                          </div>
                        )}
                        {renderUsers.map(other => {
                          return (
                            <div key={other.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid rgba(0,0,0,0.08)', transition: 'transform .12s ease, box-shadow .12s ease' }}
                                 onMouseEnter={(e)=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 3px 0 rgba(0,0,0,0.15)'; }}
                                 onMouseLeave={(e)=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}
                             >
                              <span onClick={() => setProfileUser(other?.username)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ position: 'relative', width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: '#f5f5f5', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#6a3ecb', fontFamily: 'Kodchasan, sans-serif' }}>
                                  {other?.profile_image ? <img src={toImageUrl(other.profile_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ((other?.username || 'U').charAt(0).toUpperCase())}
                                  <span style={{ position: 'absolute', right: -1, bottom: -1, width: 8, height: 8, borderRadius: '50%', background: '#9e9e9e', border: '1px solid #fff' }} />
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700 }}>{other?.username || 'User'}</div>
                                  <div style={{ fontSize: 12, opacity: 0.7 }}>{other?.role ? other.role.charAt(0).toUpperCase() + other.role.slice(1) : ''}</div>
                                </div>
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button onClick={() => setProfileUser(other?.username)} style={{ background: '#ffae0b', color: '#000', border: '2px solid #2d1c3f', padding: '6px 10px', borderRadius: 10, fontWeight: 800, boxShadow: '0 3px 0 rgba(0,0,0,0.15)', transition: 'transform .12s ease, box-shadow .12s ease, background-color .12s ease' }} onMouseEnter={(e)=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 0 rgba(0,0,0,0.25)'; e.currentTarget.style.background='#e89d06'; }} onMouseLeave={(e)=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 3px 0 rgba(0,0,0,0.15)'; e.currentTarget.style.background='#ffae0b'; }}>View</button>
                                <button onClick={() => setConfirm({ type: 'remove', user: other })} style={{ background: '#6a3ecb', color: '#fff', border: '2px solid #2d1c3f', padding: '6px 10px', borderRadius: 12, fontWeight: 800, transition: 'transform .12s ease, box-shadow .12s ease, background-color .12s ease, color .12s ease, border-color .12s ease' }}
                                onMouseEnter={(e)=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 3px 0 rgba(0,0,0,0.2)'; e.currentTarget.style.background='#e53935'; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='#e53935'; }}
                                onMouseLeave={(e)=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='#2d1c3f'; }}
                              >Remove</button>
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                          <button onClick={() => navigate('/friends')} style={{ background: '#ffae0b', color: '#000', border: '2px solid #2d1c3f', padding: '8px 12px', borderRadius: 10, fontWeight: 800, fontFamily: 'Kodchasan, sans-serif', boxShadow: '0 3px 0 rgba(0,0,0,0.15)', transition: 'transform .12s ease, box-shadow .12s ease, background-color .12s ease, color .12s ease, border-color .12s ease' }} onMouseEnter={(e)=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 5px 0 rgba(0,0,0,0.22)'; e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='#6a3ecb'; }} onMouseLeave={(e)=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 3px 0 rgba(0,0,0,0.15)'; e.currentTarget.style.background='#ffae0b'; e.currentTarget.style.color='#000'; e.currentTarget.style.borderColor='#2d1c3f'; }}>
                            Manage friends
                          </button>
                        </div>
                      </div>
                    </>
                )}
            </div>

            {/* Legacy Add Friend modal removed */}

            {profileUser && (
              <UserProfileModal username={profileUser} token={token} onClose={() => setProfileUser('')} />
            )}

            {confirm.request || confirm.user ? (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 450, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: '#6a3ecb', color: '#fff', padding: 16, borderRadius: 10, width: 340, border: '2px solid #2d1c3f', boxShadow: '0 12px 24px rgba(0,0,0,0.25)' }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    {confirm.type === 'accept' ? 'Accept Friend Request' : confirm.type === 'reject' ? 'Reject Friend Request' : 'Remove Friend'}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    {confirm.type === 'remove'
                      ? (<span>Are you sure you want to remove <strong style={{ color: '#fff' }}>{confirm.user?.username}</strong> from your friends?</span>)
                      : (<span>Are you sure you want to {confirm.type} this request from <strong style={{ color: '#fff' }}>{confirm.request?.sender?.username}</strong>?</span>)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setConfirm({ type: '', request: null, user: null })} style={{ padding: '8px 12px', borderRadius: 8, background: '#ffffff', color: '#2d1c3f', border: '2px solid #2d1c3f', fontWeight: 700 }}>Cancel</button>
                    {confirm.type === 'accept' && (
                      <button onClick={() => { acceptRequest(confirm.request); setConfirm({ type: '', request: null, user: null }); }} style={{ padding: '8px 12px', borderRadius: 8, background: '#12af59', color: '#fff', border: '2px solid #0b7f3e', fontWeight: 800 }}>Accept</button>
                    )}
                    {confirm.type === 'reject' && (
                      <button onClick={() => { rejectRequest(confirm.request); setConfirm({ type: '', request: null, user: null }); }} style={{ padding: '8px 12px', borderRadius: 8, background: '#e53935', color: '#fff', border: '2px solid #b71c1c', fontWeight: 800 }}>Reject</button>
                    )}
                    {confirm.type === 'remove' && (
                      <button onClick={async () => {
                        try {
                          const otherId = Number(confirm.user?.id || 0);
                          if (!Number.isFinite(otherId) || otherId <= 0) return;
                          await apiRequest(`/api/friends/remove/${otherId}`, { method: 'DELETE', token });
                          await Promise.all([refreshFriends(), refreshRequests()]);
                          try { const fresh = await apiRequest(`/api/friends/${currentId}`, { token }); const rows = (fresh && fresh.friends) || []; const dd2 = new Set(); const lst2 = []; for (const fr of rows) { const uid = Number(fr.user_id), fid = Number(fr.friend_id); const other2 = (uid === currentId) ? fr.friend : (fid === currentId ? fr.user : (fr.friend || fr.user)); const idn = Number(other2?.id); if (!Number.isFinite(idn) || idn === currentId || dd2.has(idn)) continue; dd2.add(idn); lst2.push(other2); } setOwnFriendsUsers(lst2); } catch(_) {}
                          window.dispatchEvent(new CustomEvent('friends:update'));
                          window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Friend removed' } }));
                        } catch (e) {
                          window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to remove friend' } }));
                        } finally {
                          setConfirm({ type: '', request: null, user: null });
                        }
                      }} style={{ padding: '8px 12px', borderRadius: 8, background: '#e53935', color: '#fff', border: '2px solid #b71c1c', fontWeight: 800 }}>Remove</button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
        </aside>
    );
};

export default SidebarRight;