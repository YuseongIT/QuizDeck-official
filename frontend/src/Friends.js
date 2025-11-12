import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiRequest, toImageUrl } from './api';
import Header from './Header';
import SidebarLeft from './SidebarLeft';
import SidebarRight from './SidebarRight';
import { CustomThemeProvider, mainContentStyles, theme, overlayStyles } from './theme';
import { Box, Typography, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useFriends as useFriendsCtx } from './FriendContext';

export default function Friends() {
  const { token, user } = useAuth();
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingId, setAddingId] = useState('');
  const [busy, setBusy] = useState(false);
  const { incoming, outgoing, refreshFriends: ctxRefreshFriends, refreshRequests: ctxRefreshRequests } = useFriendsCtx();

  // Search users (by username), mirroring SidebarRight behavior
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  // Auth readiness and id hydration (call /api/me at most once)
  const [effectiveId, setEffectiveId] = useState(() => Number((user?.userID ?? user?.id) || 0));
  const meFetchedOnce = useRef(false);
  useEffect(() => {
    const uid = Number((user?.userID ?? user?.id) || 0);
    if (Number.isFinite(uid) && uid > 0) {
      setEffectiveId(uid);
      meFetchedOnce.current = true;
    } else if (token && !meFetchedOnce.current) {
      meFetchedOnce.current = true;
      (async () => {
        try {
          const data = await apiRequest('/api/me', { token });
          const u = (data && (data.user || data)) || {};
          const idn = Number(u?.id || 0);
          if (Number.isFinite(idn) && idn > 0) setEffectiveId(idn);
          else {
            // Fallback to /api/profile if /api/me has no id
            try {
              const prof = await apiRequest('/api/profile', { token });
              const pid = Number((prof && (prof.id || (prof.user && prof.user.id))) || 0);
              if (Number.isFinite(pid) && pid > 0) setEffectiveId(pid);
            } catch (_) {}
          }
        } catch (_) {}
      })();
    }
  }, [user?.id, token]);
  const currentId = Number(effectiveId || 0);
  const authReady = !!token && Number.isFinite(currentId) && currentId > 0;

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!authReady) return;
      try {
        setLoading(true);
        setError('');
        // Primary by id; fallback to generic list
        let data = await apiRequest(`/api/friends/${currentId}`, { token });
        let rows = (data && Array.isArray(data.friends)) ? data.friends : [];
        if (!rows.length) {
          const data2 = await apiRequest('/api/friends', { token });
          rows = Array.isArray(data2) ? data2 : [];
        }
        if (mounted) setFriends(rows || []);
      } catch (e) {
        if (mounted) setError(e.message || 'Failed to load friends');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    const onUpdate = () => { if (authReady) load(); };
    window.addEventListener('friends:update', onUpdate);
    window.addEventListener('requests:update', onUpdate);
    return () => { mounted = false; window.removeEventListener('friends:update', onUpdate); window.removeEventListener('requests:update', onUpdate); };
  }, [authReady, currentId, token]);

  // Debounced user search
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

  // Send friend request by user id
  async function sendRequestById(id) {
    setBusy(true);
    setError('');
    try {
      await apiRequest('/api/friends/request', { method: 'POST', token, body: { receiver_id: id } });
      await Promise.all([ctxRefreshRequests(), ctxRefreshFriends()]);
      window.dispatchEvent(new CustomEvent('requests:update'));
    } catch (e) { setError(e.message || 'Failed to send friend request'); }
    finally { setBusy(false); }
  }

  async function accept(friend) {
    setBusy(true);
    setError('');
    try {
      const updated = await apiRequest(`/api/friends/${friend.id}`, { method: 'PUT', token, body: { status: 'accepted' } });
      setFriends(prev => prev.map(f => f.id === updated.id ? updated : f));
    } catch (e) {
      setError(e.message || 'Failed to accept');
    } finally {
      setBusy(false);
    }
  }

  async function removeByUserId(otherId) {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/api/friends/remove/${otherId}`, { method: 'DELETE', token });
      // refresh list
      try {
        const data = await apiRequest(`/api/friends/${currentId}`, { token });
        const rows = (data && Array.isArray(data.friends)) ? data.friends : [];
        setFriends(rows || []);
      } catch (_) {
        const data2 = await apiRequest('/api/friends', { token });
        setFriends(Array.isArray(data2) ? data2 : []);
      }
    } catch (e) {
      setError(e.message || 'Failed to remove');
    } finally {
      setBusy(false);
    }
  }

  const myId = currentId;
  const shown = friends
    .filter(fr => {
      const st = String(fr.status || '').toLowerCase();
      return !st || st === 'accepted';
    })
    .map(fr => {
      const uid = Number(fr.user_id), fid = Number(fr.friend_id);
      const other = (uid === myId) ? fr.friend : (fid === myId ? fr.user : (fr.friend || fr.user));
      return { fr, other };
    })
    .filter(x => Number.isFinite(Number(x.other?.id)) && Number(x.other?.id) !== myId);

  // Relationship sets for Find Users list
  const acceptedIds = new Set(
    (friends || [])
      .filter(fr => String(fr.status || '').toLowerCase() === 'accepted')
      .map(fr => {
        const uid = Number(fr.user_id), fid = Number(fr.friend_id);
        return (uid === myId) ? Number(fr.friend?.id) : (fid === myId ? Number(fr.user?.id) : NaN);
      })
      .filter(v => Number.isFinite(v))
  );
  const pendingOutgoingIds = new Set((outgoing || []).map(r => Number(r.receiver_id)).filter(v => Number.isFinite(v)));
  const pendingIncomingIds = new Set((incoming || []).map(r => Number(r.sender_id)).filter(v => Number.isFinite(v)));
  const isFriendsWith = (id) => acceptedIds.has(Number(id));
  const isPendingWith = (id) => pendingOutgoingIds.has(Number(id)) || pendingIncomingIds.has(Number(id));

  const containerStyle = { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#d5ceed' };

  return (
    <CustomThemeProvider>
      <div style={containerStyle}>
        <Header 
          isDashboard={true}
          isLeftOpen={isLeftOpen}
          isRightOpen={isRightOpen}
          toggleLeft={() => setIsLeftOpen(prev => !prev)}
          toggleRight={() => setIsRightOpen(prev => !prev)}
        />
        <div style={{ position: 'relative', flexGrow: 1 }}>
          <SidebarLeft isOpen={isLeftOpen} />
          <div style={mainContentStyles.base}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <IconButton aria-label="Back" onClick={() => navigate(-1)} sx={{ color: theme.palette.secondary.main }}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.secondary.main }}>Back</Typography>
            </Box>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, color: '#6a3ecb', fontFamily: 'Kodchasan, sans-serif' }}>Friends</h2>
            </div>

            {error && <div style={{ background: '#fdecea', color: '#611a15', padding: 12, borderRadius: 8, marginBottom: 12, fontFamily: 'Kodchasan, sans-serif' }}>{error}</div>}

            {/* Find Users (mirrors SidebarRight) */}
            <div style={{ background: '#fff', color: '#333', borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: '#6a3ecb', marginBottom: 6, fontFamily: 'Kodchasan, sans-serif' }}>Find Users</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setActiveIdx(-1); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { if (results[0]) { navigate(`/u/${encodeURIComponent(results[0].username)}`); return; } }
                    if (!results.length) return;
                    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => (i + 1) % results.length); }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => (i - 1 + results.length) % results.length); }
                    if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); navigate(`/u/${encodeURIComponent(results[activeIdx].username)}`); }
                  }}
                  placeholder="Search by username…"
                  style={{ flex: 1, width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #ddd', outline: 'none', boxShadow: '0 2px 0 rgba(0,0,0,0.06)', boxSizing: 'border-box', fontFamily: 'Kodchasan, sans-serif' }}
                />
                <button
                  onClick={() => { if (results[0]) navigate(`/u/${encodeURIComponent(results[0].username)}`); }}
                  style={{ background: '#ffae0b', color: '#000', border: '2px solid #2d1c3f', padding: '10px 12px', borderRadius: 10, fontWeight: 800, fontFamily: 'Kodchasan, sans-serif', boxShadow: '0 4px 0 rgba(0,0,0,0.2)', transition: 'transform .12s ease, box-shadow .12s ease' }}
                  onMouseEnter={(e)=>{e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 0 rgba(0,0,0,0.25)';}}
                  onMouseLeave={(e)=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 0 rgba(0,0,0,0.2)';}}
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
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8, fontFamily: 'Kodchasan, sans-serif' }}>No results for "{q.trim()}"</div>
              )}
              {!searching && results.length > 0 && (
                <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                  {results.map((u,idx) => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: idx===activeIdx ? '#f2ecff' : '#fff', color: '#333', borderRadius: 8, padding: 8, transition: 'transform .12s ease, box-shadow .12s ease' }}
                      onMouseEnter={(e)=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 4px 0 rgba(0,0,0,0.2)'; setActiveIdx(idx); }}
                      onMouseLeave={(e)=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}
                    >
                      <div onClick={() => navigate(`/u/${encodeURIComponent(u.username)}`)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: '#f5f5f5', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#6a3ecb', fontFamily: 'Kodchasan, sans-serif' }}>
                          {u.profile_image ? <img src={toImageUrl(u.profile_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ((u.username || 'U').charAt(0).toUpperCase())}
                        </div>
                        <div style={{ fontWeight: 700, fontFamily: 'Kodchasan, sans-serif' }}>{u.username}</div>
                      </div>
                      {isFriendsWith(u.id) ? (
                        <span style={{ padding: '6px 10px', borderRadius: 10, fontWeight: 800, color: '#0b7f3e', border: '1px solid #a5d6a7', background: '#e8f5e9', fontFamily: 'Kodchasan, sans-serif' }}>Friends</span>
                      ) : isPendingWith(u.id) ? (
                        <span style={{ padding: '6px 10px', borderRadius: 10, fontWeight: 800, color: '#616161', border: '1px solid #e0e0e0', background: '#fafafa', fontFamily: 'Kodchasan, sans-serif' }}>Pending</span>
                      ) : (
                        <button
                          onClick={async () => {
                            await sendRequestById(Number(u.id));
                            setQ(''); setResults([]);
                          }}
                          style={{ background: '#ffae0b', color: '#000', border: '2px solid #2d1c3f', padding: '8px 10px', borderRadius: 10, fontWeight: 800, transition: 'transform .12s ease, box-shadow .12s ease', fontFamily: 'Kodchasan, sans-serif', boxShadow: '0 4px 0 rgba(0,0,0,0.2)'}}
                          onMouseEnter={(e)=>{e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 0 rgba(0,0,0,0.25)';}}
                          onMouseLeave={(e)=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 0 rgba(0,0,0,0.2)';}}
                        >Add</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {loading ? (
              <div className="loader-container" style={{ height: 180 }}>
                <div className="loader"></div>
                <div className="loader-text">Loading...</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                {shown.map(({ fr, other }) => {
                  return (
                    <div key={fr.id} style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 10px rgba(0,0,0,0.10)', minHeight: 160, position: 'relative' }}>
                      {String(fr.status || '').toLowerCase() === 'accepted' && (
                        <span style={{ position: 'absolute', top: 12, right: 12, padding: '4px 8px', borderRadius: 999, border: '1px solid #a5d6a7', background: '#e8f5e9', color: '#0b7f3e', fontWeight: 800, fontSize: 12, fontFamily: 'Kodchasan, sans-serif' }}>Friends</span>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: '#f5f5f5', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {other?.profile_image ? <img src={toImageUrl(other.profile_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'Kodchasan, sans-serif', color: '#6a3ecb' }}>{(other?.username || 'U').charAt(0).toUpperCase()}</span>}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: '#6a3ecb', fontSize: 18 }}>{other?.username || 'Unknown'}</div>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>{other?.role ? other.role.charAt(0).toUpperCase() + other.role.slice(1) : ''}</div>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4, fontSize: 13, fontFamily: 'Kodchasan, sans-serif' }}>
                        <div><span style={{ opacity: 0.7 }}>Status:</span> <strong>{other?.status || other?.profile_status || other?.status_text || other?.statusMessage || '—'}</strong></div>
                        <div><span style={{ opacity: 0.7 }}>Courses Enrolled:</span> <strong>{Array.isArray(other?.courses) ? other.courses.length : (Number(other?.courses_enrolled) || 0)}</strong></div>
                        <div style={{ gridColumn: '1 / -1' }}><span style={{ opacity: 0.7 }}>Bio:</span> <span>{other?.bio || other?.about || other?.description || '—'}</span></div>
                        <div style={{ gridColumn: '1 / -1' }}><span style={{ opacity: 0.7 }}>Role:</span> <strong>{other?.role ? other.role.charAt(0).toUpperCase() + other.role.slice(1) : '—'}</strong></div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                        {fr.status === 'pending' && Number(fr.friend_id) === myId && (
                          <button disabled={busy} onClick={() => accept(fr)} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: theme.palette.action.main, color: '#fff', fontWeight: 700, transition: 'transform .12s ease, box-shadow .12s ease' }}
                            onMouseEnter={(e)=>{e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 3px 0 rgba(0,0,0,0.2)';}}
                            onMouseLeave={(e)=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none';}}
                          >Accept</button>
                        )}
                        <button onClick={() => navigate(`/u/${encodeURIComponent(other?.username || '')}`)} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e6e0f4', background: '#f7f3ff', color: '#6a3ecb', fontWeight: 800, fontFamily: 'Kodchasan, sans-serif', transition: 'transform .12s ease, box-shadow .12s ease, background-color .12s ease, color .12s ease, border-color .12s ease' }}
                          onMouseEnter={(e)=>{e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 3px 0 rgba(0,0,0,0.2)'; e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='#6a3ecb';}}
                          onMouseLeave={(e)=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='#f7f3ff'; e.currentTarget.style.color='#6a3ecb'; e.currentTarget.style.borderColor='#e6e0f4';}}
                        >View</button>
                        <button disabled={busy} onClick={() => removeByUserId(Number(other?.id))} style={{ padding: '8px 12px', borderRadius: 10, border: '2px solid #e53935', background: '#fff', color: '#e53935', fontWeight: 800, fontFamily: 'Kodchasan, sans-serif', transition: 'transform .12s ease, box-shadow .12s ease, background-color .12s ease, color .12s ease' }}
                          onMouseEnter={(e)=>{e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 3px 0 rgba(229,57,53,0.35)'; e.currentTarget.style.background='#e53935'; e.currentTarget.style.color='#fff';}}
                          onMouseLeave={(e)=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#e53935';}}
                        >Remove</button>
                      </div>
                    </div>
                  );
                })}
                {shown.length === 0 && <div style={{ opacity: 0.7, fontFamily: 'Kodchasan, sans-serif' }}>No friends found.</div>}
              </div>
            )}
          </div>
          <SidebarRight isOpen={isRightOpen} />
          {(isLeftOpen || isRightOpen) && (
            <div style={overlayStyles} onClick={() => { setIsLeftOpen(false); setIsRightOpen(false); }} />
          )}
        </div>
      </div>
    </CustomThemeProvider>
  );
}
