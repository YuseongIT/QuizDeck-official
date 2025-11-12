import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiRequest, toImageUrl, API_BASE } from './api';
import { useNavigate, useParams } from 'react-router-dom';
import SidebarRight from './SidebarRight';
import { theme } from './theme';
import { useFriends } from './FriendContext';
import Header from './Header';
import SidebarLeft from './SidebarLeft';
import { CustomThemeProvider, mainContentStyles, overlayStyles } from './theme';
import { Box, Typography, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import UserProfileModal from './UserProfileModal';

export default function Profile() {
  const { token, user, setUser } = useAuth();
  const navigate = useNavigate();
  const { username: paramUsername } = useParams();
  const { friends, refreshFriends, refreshRequests } = useFriends();
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [bioText, setBioText] = useState('');
  const [saving, setSaving] = useState(false);
  const [profileUser, setProfileUser] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const path = paramUsername ? `/api/profile/${encodeURIComponent(paramUsername)}` : '/api/profile';
        const res = await apiRequest(path, { token });
        if (mounted) {
          let enriched = res;
          try {
            const userId = res?.id;
            if (userId) {
              const list = await apiRequest(`/api/friends/${userId}`, { token });
              if (list && Array.isArray(list.friends)) {
                enriched = { ...res, friends: list.friends };
              }
            }
          } catch (_) {}
          setData(enriched);
          if (!paramUsername) {
            setStatusText(res?.status || '');
            setBioText(res?.bio || '');
          }
        }
      } catch (e) {
        if (mounted) setError(e.message || 'Failed to load profile');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    // Reset previous viewed profile data to prevent leaking old state when switching usernames
    setData(null);
    if (token) load();
    return () => { mounted = false; };
  }, [paramUsername, token]);

  // Broadcast the exact friends user list shown in Profile so SidebarRight can mirror it strictly
  useEffect(() => {
    try {
      const list = paramUsername ? (data?.friends || []) : (friends || data?.friends || []);
      const viewedId = Number(data?.id || 0);
      const currentIdNum = Number(user?.id || 0);
      const dedupe = new Set();
      const users = (list || [])
        .filter(fr => (String(fr.status || '').toLowerCase() === 'accepted'))
        .map(fr => {
          const uid = Number(fr.user_id);
          const fid = Number(fr.friend_id);
          const other = (uid === viewedId) ? fr.friend : (fid === viewedId ? fr.user : (fr.friend || fr.user));
          return other;
        })
        .filter(u => {
          const oid = Number(u?.id);
          if (!Number.isFinite(oid)) return false;
          if (oid === viewedId || oid === currentIdNum) return false;
          if (dedupe.has(oid)) return false; dedupe.add(oid); return true;
        });
      window.dispatchEvent(new CustomEvent('profile:friends:list', { detail: { users } }));
    } catch (_) {}
  }, [data?.friends, friends, data?.id, user?.id, paramUsername]);

  // Refetch when friend requests change (accept/reject from bell or sidebar)
  useEffect(() => {
    function onUpdate() {
      // re-trigger load by changing dependency via a small inline fetch
      (async () => {
        try {
          setLoading(true);
          const path = paramUsername ? `/api/profile/${encodeURIComponent(paramUsername)}` : '/api/profile';
          const res = await apiRequest(path, { token });
          // Also fetch canonical friends list to avoid stale embedded data
          try {
            await refreshRequests();
            const freshFriends = await refreshFriends();
            setData(prev => ({ ...(res || prev), friends: Array.isArray(freshFriends) ? freshFriends : (res?.friends || []) }));
          } catch (_) {
            setData(res);
          }
        } catch (e) { /* ignore */ } finally { setLoading(false); }
      })();
    }
    window.addEventListener('requests:update', onUpdate);
    function onFriends(e){
      if (!paramUsername && e && e.detail && Array.isArray(e.detail.friends)) {
        setData(prev => prev ? { ...prev, friends: e.detail.friends } : prev);
      } else {
        onUpdate();
      }
    }
    window.addEventListener('friends:update', onFriends);
    return () => { window.removeEventListener('requests:update', onUpdate); window.removeEventListener('friends:update', onFriends); };
  }, [token, paramUsername]);

  async function onUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['png','jpg','jpeg'].includes(ext)) {
      const msg = 'Only PNG or JPG images are allowed.';
      setError(msg);
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: msg } }));
      return;
    }
    setUploading(true);
    setError('');
    const prev = data?.profile_image;
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch(API_BASE + '/api/profile/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      let json = null;
      try { json = await res.json(); } catch (_) { json = null; }
      if (!res.ok) {
        const msg = (json && (json.message || (json.errors && json.errors.image && json.errors.image[0]))) || 'Upload failed';
        throw new Error(msg);
      }
      const backendPath = json.profile_image || json.imageUrl;
      const absolute = toImageUrl(backendPath);
      // Update screen immediately without cache-busting to allow browser caching
      setData(prev => ({ ...prev, profile_image: absolute }));
      // Persist to auth user (stores raw backend path so next sessions render via toImageUrl)
      try { setUser(prev => prev ? { ...prev, profile_image: backendPath } : prev); } catch(_) {}
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Profile picture updated successfully.' } }));
      window.dispatchEvent(new CustomEvent('profile:update', { detail: { profile_image: absolute } }));
    } catch (e) {
      setError(e.message || 'Upload failed');
      // revert
      setData(prev => ({ ...prev, profile_image: prev ? prev.profile_image : prev }));
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Upload failed' } }));
    } finally {
      setUploading(false);
    }
  }

  async function onSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiRequest('/api/profile/bio', { method: 'POST', token, body: { status: statusText, bio: bioText } });
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const isTeacher = useMemo(() => user?.role === 'teacher', [user]);
  // Treat /u/:username that matches the current user as self-view
  const viewingOther = !!paramUsername && paramUsername !== user?.username;
  const prettyRole = (r) => r ? r.charAt(0).toUpperCase() + r.slice(1) : '';
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
          <div style={{ ...mainContentStyles.base, fontFamily: 'Kodchasan, sans-serif' }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <IconButton aria-label="Back" onClick={() => navigate(-1)} sx={{ color: theme.palette.secondary.main }}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.secondary.main }}>Back</Typography>
            </Box>

            {/* Header section (centered) */}
            <div style={{ background: '#f4efff', border: '1px solid #e6e0f4', borderRadius: 12, padding: 20, marginBottom: 16, textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 190, height: 190, borderRadius: '50%', background: '#fff', border: '3px solid #e6e0f4', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {(() => {
                    const img = data?.profile_image; // only use viewed user's image
                    if (img) return (<img key={toImageUrl(img)} src={toImageUrl(img)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />);
                    const initial = (data?.username || 'U').charAt(0).toUpperCase();
                    return (<span style={{ fontSize: 72, color: '#6a3ecb', fontWeight: 800, fontFamily: 'Kodchasan, sans-serif' }}>{initial}</span>);
                  })()}
                </div>
                <div style={{ fontWeight: 800, fontSize: 22, color: '#6a3ecb' }}>{data?.username || ''}</div>
                {!viewingOther && (statusText || data?.status) && <div style={{ opacity: 0.8, marginTop: -6 }}>{statusText || data?.status}</div>}
                {data?.join_date && (
                  <div style={{ display: 'inline-block', padding: '6px 12px', borderRadius: 999, background: '#e6e0f4', color: '#6a3ecb', fontWeight: 700, fontSize: 12 }}>Joined on {data.join_date}</div>
                )}
                {!viewingOther && (
                  <div style={{ marginTop: 8 }}>
                    <label style={{ display: 'inline-block', padding: '8px 12px', borderRadius: 8, background: theme.palette.primary.main, color: '#fff', cursor: 'pointer', fontWeight: 700, boxShadow: '0 3px 0 rgba(0,0,0,0.2)', transition: 'transform .12s ease, box-shadow .12s ease, background-color .12s ease' }}
                      onMouseEnter={(e)=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 5px 0 rgba(0,0,0,0.25)'; }}
                      onMouseLeave={(e)=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 3px 0 rgba(0,0,0,0.2)'; }}
                    >
                      {uploading ? 'Uploading...' : 'Change Profile Photo'}
                      <input type="file" accept="image/*" onChange={onUpload} style={{ display: 'none' }} />
                    </label>
                  </div>
                )}
                {viewingOther && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    {data?.is_friend ? (
                      <button onClick={async () => {
                        try {
                          const idToRemove = data?.id; // remove friendship with this profile's user
                          if (!idToRemove) return;
                          await apiRequest(`/api/friends/remove/${idToRemove}`, { method: 'DELETE', token });
                          // Refetch the displayed user's friends list
                          const list = await apiRequest(`/api/friends/${idToRemove}`, { token });
                          setData(prev => ({ ...(prev || {}), friends: list?.friends || [] }));
                          // Also dispatch global updates
                          try { window.dispatchEvent(new CustomEvent('friends:update', { detail: { friends: await apiRequest('/api/friends', { token }) } })); } catch(_) {}
                        } catch (e) { setError(e.message || 'Failed to unfriend'); }
                      }} style={{ padding: '8px 12px', borderRadius: 10, border: '2px solid #e53935', background: '#fff', color: '#e53935', fontWeight: 800, fontFamily: 'Kodchasan, sans-serif', transition: 'transform .12s ease, box-shadow .12s ease, background-color .12s ease, color .12s ease' }}
                        onMouseEnter={(e)=>{e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 3px 0 rgba(229,57,53,0.35)'; e.currentTarget.style.background='#e53935'; e.currentTarget.style.color='#fff';}}
                        onMouseLeave={(e)=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#e53935';}}
                      >Remove Friend</button>
                    ) : data?.pending_from_viewer ? (
                      <span style={{ padding: '8px 12px', borderRadius: 8, background: '#fff3e0', color: '#e65100', fontWeight: 700 }}>Pending</span>
                    ) : data?.pending_from_other ? (
                      <span style={{ padding: '8px 12px', borderRadius: 8, background: '#fff3e0', color: '#e65100', fontWeight: 700 }}>Requested you</span>
                    ) : (
                      <button onClick={async () => {
                        try {
                          await apiRequest('/api/friends/send', { method: 'POST', token, body: { receiver_username: paramUsername } });
                          navigate(0);
                        } catch (e) { setError(e.message || 'Failed to send request'); }
                      }} style={{ padding: '10px 14px', borderRadius: 12, background: 'linear-gradient(90deg, #6a3ecb, #ff4fa3)', color: '#fff', border: '1px solid #5b34ad', fontWeight: 800, boxShadow: '0 4px 0 rgba(0,0,0,0.2)' }} onMouseEnter={(e)=>{e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 0 rgba(0,0,0,0.25)';}} onMouseLeave={(e)=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 0 rgba(0,0,0,0.2)';}}>Add Friend</button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {error && <div style={{ background: '#fdecea', color: '#611a15', padding: 12, borderRadius: 8, marginBottom: 12 }}>{error}</div>}

            {loading ? (
              <div className="loader-container">
                <div className="loader"></div>
                <div className="loader-text">Loading...</div>
              </div>
            ) : (
              data && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                  {/* Personal Information card */}
                  <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <div style={{ fontWeight: 800, color: '#e91e63', marginBottom: 12 }}>Personal Information</div>
                    {!viewingOther ? (
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        setSaving(true);
                        setError('');
                        try {
                          await apiRequest('/api/profile/bio', { method: 'POST', token, body: { status: statusText, bio: bioText } });
                          setData(prev => prev ? { ...prev, status: statusText, bio: bioText } : prev);
                          window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Profile updated.' } }));
                        } catch (e) {
                          setError(e.message || 'Failed to save');
                        } finally { setSaving(false); }
                      }}>
                        <div style={{ display: 'grid', gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#ff4fa3', marginBottom: 6 }}>Status</div>
                            <input value={statusText} onChange={e => setStatusText(e.target.value)} maxLength={100} placeholder="Status (one line, max 100 characters)" style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 10, border: '1px solid #ddd' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#ff4fa3', marginBottom: 6 }}>Bio</div>
                            <textarea value={bioText} onChange={e => setBioText(e.target.value)} maxLength={300} placeholder="Bio (About Me) — max 300 characters" rows={4} style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 10, border: '1px solid #ddd' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button disabled={saving} type="submit" style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: theme.palette.primary.main, color: '#fff', fontWeight: 700, boxShadow: '0 3px 0 rgba(0,0,0,0.2)', transition: 'transform .12s ease, box-shadow .12s ease, background-color .12s ease' }}
                              onMouseEnter={(e)=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 5px 0 rgba(0,0,0,0.25)'; }}
                              onMouseLeave={(e)=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 3px 0 rgba(0,0,0,0.2)'; }}
                            >{saving ? 'Saving...' : 'Save Changes'}</button>
                          </div>
                        </div>
                      </form>
                    ) : (
                      <div style={{ display: 'grid', gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#ff4fa3', marginBottom: 6 }}>Status</div>
                          <div style={{ padding: 12, borderRadius: 10, border: '1px solid #eee', background: '#fafafa' }}>{data?.status || 'No status set.'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#ff4fa3', marginBottom: 6 }}>Bio</div>
                          <div style={{ padding: 12, borderRadius: 10, border: '1px solid #eee', background: '#fafafa' }}>{data?.bio || 'No bio provided.'}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Account Settings card (only for self) */}
                  {!viewingOther && (
                    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                      <div style={{ fontWeight: 800, color: '#6a3ecb', marginBottom: 12 }}>Account Settings</div>
                      <div style={{ display: 'grid', gap: 10 }}>
                        <input value={data.email} disabled readOnly style={{ padding: 12, borderRadius: 10, border: '1px solid #ddd', opacity: 0.8 }} />
                        <div>
                          <button type="button" onClick={() => navigate('/settings')} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: theme.palette.primary.main, color: '#fff', fontWeight: 700, boxShadow: '0 3px 0 rgba(0,0,0,0.2)', transition: 'transform .12s ease, box-shadow .12s ease, background-color .12s ease' }}
                            onMouseEnter={(e)=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 5px 0 rgba(0,0,0,0.25)'; }}
                            onMouseLeave={(e)=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 3px 0 rgba(0,0,0,0.2)'; }}
                          >Manage in Settings</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Courses chip list */}
                  <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <div style={{ fontWeight: 800, color: '#6a3ecb', marginBottom: 10 }}>Courses</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {(data.courses || []).map(c => (
                        <button
                          key={c.id}
                          onClick={async () => {
                            try {
                              const course = await apiRequest(`/api/courses/${c.id}`, { token });
                              const isTeacherViewer = (user?.role === 'teacher');
                              if (isTeacherViewer || course?.is_public || course?.enrolled) {
                                navigate(`/course/${c.id}`);
                              } else {
                                window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: 'The course is private. Join it first.' } }));
                              }
                            } catch (e) {
                              window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to open course' } }));
                            }
                          }}
                          style={{
                            padding: '10px 14px',
                            border: '1px solid #e6e0f4',
                            borderRadius: 12,
                            background: '#f7f3ff',
                            color: '#6a3ecb',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 3px 0 rgba(106,62,203,0.18)',
                            transition: 'transform .12s ease, box-shadow .12s ease, background-color .12s ease, color .12s ease, border-color .12s ease'
                          }}
                          onMouseEnter={(e)=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 5px 0 rgba(106,62,203,0.28)'; e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='#6a3ecb'; }}
                          onMouseLeave={(e)=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 3px 0 rgba(106,62,203,0.18)'; e.currentTarget.style.background='#f7f3ff'; e.currentTarget.style.color='#6a3ecb'; e.currentTarget.style.borderColor='#e6e0f4'; }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <span>{c.title}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.85 }}>
                              {c.created_at ? `Created ${new Date(c.created_at).toLocaleDateString()}` : (c.enrolled_at ? `Enrolled ${new Date(c.enrolled_at).toLocaleDateString()}` : '')}
                            </span>
                          </div>
                        </button>
                      ))}
                      {(data.courses || []).length === 0 && <div style={{ opacity: 0.7 }}>No courses yet.</div>}
                    </div>
                  </div>

                  {/* Friends list */}
                  <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <div style={{ fontWeight: 800, color: '#6a3ecb', marginBottom: 10 }}>Friends</div>
                    {(() => {
                      const list = paramUsername ? (data.friends || []) : (friends || data.friends || []);
                      const viewedId = Number(data?.id || 0);
                      const currentIdNum = Number(user?.id || 0);
                      // Build counterpart user and exclude self (by viewedId/currentId) with numeric comparison; also dedupe by other.id
                      const dedupe = new Set();
                      const acceptedFriends = (list || [])
                        .filter(fr => (String(fr.status || '').toLowerCase() === 'accepted'))
                        .map(fr => {
                          const uid = Number(fr.user_id);
                          const fid = Number(fr.friend_id);
                          const other = (uid === viewedId) ? fr.friend : (fid === viewedId ? fr.user : (fr.friend || fr.user));
                          return { original: fr, other };
                        })
                        .filter(x => {
                          const oid = Number(x.other?.id);
                          if (!Number.isFinite(oid)) return false;
                          if (oid === viewedId || oid === currentIdNum) return false;
                          if (dedupe.has(oid)) return false;
                          dedupe.add(oid);
                          return true;
                        });
                      return (
                        <div style={{ display: 'grid', gap: 8 }}>
                          {acceptedFriends.map(({ original: fr, other }) => {
                            return (
                              <div key={fr.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: '1px solid #eee', borderRadius: 10, padding: '8px 10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: '#f5f5f5', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {other?.profile_image ? <img src={toImageUrl(other.profile_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.src=''; }} /> : (
                                      <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'Kodchasan, sans-serif', color: '#6a3ecb' }}>{(other?.username || 'U').charAt(0).toUpperCase()}</span>
                                    )}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 700 }}>{other?.username || 'User'}</div>
                                    <div style={{ fontSize: 12, opacity: 0.7 }}>{other?.role ? other.role.charAt(0).toUpperCase() + other.role.slice(1) : ''}</div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <button
                                    onClick={() => navigate(`/u/${encodeURIComponent(other?.username || '')}`)}
                                    style={{ background: '#f7f3ff', color: '#6a3ecb', border: '1px solid #e6e0f4', padding: '6px 10px', borderRadius: 8, fontWeight: 800, fontFamily: 'Kodchasan, sans-serif', transition: 'transform .12s ease, box-shadow .12s ease, background-color .12s ease, color .12s ease, border-color .12s ease' }}
                                    onMouseEnter={(e)=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 3px 0 rgba(0,0,0,0.2)'; e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='#6a3ecb'; }}
                                    onMouseLeave={(e)=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='#f7f3ff'; e.currentTarget.style.color='#6a3ecb'; e.currentTarget.style.borderColor='#e6e0f4'; }}
                                  >View</button>
                                </div>
                              </div>
                            );
                          })}
                          {acceptedFriends.length === 0 && <div style={{ opacity: 0.7 }}>No friends yet.</div>}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )
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
