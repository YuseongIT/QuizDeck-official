import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from './theme';
import { toImageUrl, API_BASE } from './api';
import { useAuth } from './AuthContext';
 

export default function UserProfileModal({ username, token, onClose }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState('');
  const navigate = useNavigate();
  const isSelf = (user && user.username && username) ? (user.username === username) : false;

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(API_BASE + `/api/profile/${encodeURIComponent(username)}` , {
          headers: { Authorization: `Bearer ${token}` },
        });
        let json = null;
        try { json = await res.json(); } catch (_) { json = null; }
        if (!res.ok) {
          const msg = (json && (json.message || json.error)) || 'Failed to load';
          throw new Error(msg);
        }
        if (mounted) setData(json);
      } catch (e) {
        if (mounted) setError(e.message || 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (username) load();
    return () => { mounted = false; };
  }, [username, token]);

  async function sendFriendRequest() {
    if (isSelf) {
      setError('Cannot send friend request to yourself');
      setConfirmOpen(false);
      return;
    }
    setSending(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch(API_BASE + '/api/friends/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ receiver_username: username }),
      });
      let json = null;
      try { json = await res.json(); } catch (_) { json = null; }
      if (!res.ok) {
        const msg = (json && (json.message || json.error)) || 'Failed to send request';
        throw new Error(msg);
      }
      // Mark as pending from viewer and notify app to refresh requests
      setData(prev => prev ? { ...prev, pending_from_viewer: true } : prev);
      setInfo('Friend request sent successfully.');
      try { window.dispatchEvent(new CustomEvent('requests:update')); } catch(_) {}
    } catch (e) {
      setError(e.message || 'Failed to send request');
    } finally {
      setSending(false);
      setConfirmOpen(false);
    }
  }

  useEffect(() => {
    function onKey(e){ if (e.key === 'Escape') onClose && onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div onClick={(e)=>{ if (e.target === e.currentTarget) onClose && onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', width: 420, maxWidth: '92vw', borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 0 0 2px #8E44AD, 0 0 22px rgba(142,68,173,0.45), 0 16px 32px rgba(0,0,0,0.25)'}}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottom: '1px solid #eee' }}>
          <div style={{ fontWeight: 800, color: '#6a3ecb', fontSize: 18 }}>{(data && data.username) ? data.username : 'Profile'}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', transition: 'transform .15s ease' }} onMouseEnter={(e)=>e.currentTarget.style.transform='scale(1.1)'} onMouseLeave={(e)=>e.currentTarget.style.transform='scale(1)'}>✕</button>
        </div>
        <div style={{ padding: 14 }}>
          {error && <div style={{ background: '#fdecea', color: '#611a15', padding: 10, borderRadius: 8, marginBottom: 12 }}>{error}</div>}
          {loading ? (
            <div className="loader-container" style={{ height: 140 }}>
              <div className="loader" />
              <div className="loader-text">Loading...</div>
            </div>
          ) : (
            data && (
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 12 }}>
                {/* Avatar */}
                <div style={{ width: 110, height: 110, borderRadius: 12, background: '#f5f5f5', border: '1px solid #eee', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Kodchasan, sans-serif', fontWeight: 800, color: '#6a3ecb' }}>
                  {data.profile_image ? (
                    <img src={toImageUrl(data.profile_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e)=>{ e.currentTarget.src=''; }} />
                  ) : (
                    (data.username || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                {/* Info */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-start', gap: 8 }}>
                    {data.role && <div style={{ fontSize: 14, fontWeight: 800, color: '#6a3ecb' }}>{data.role.charAt(0).toUpperCase() + data.role.slice(1)}</div>}
                  </div>
                  {data.join_date && (
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>Joined {data.join_date}</div>
                  )}
                  {/* Status */}
                  {typeof data.status === 'string' && data.status.trim() !== '' && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, color: '#ff4fa3', fontWeight: 800, marginBottom: 2, fontFamily: 'Kodchasan, sans-serif' }}>Status</div>
                      <div style={{ fontSize: 13, color: '#333' }}>{data.status}</div>
                    </div>
                  )}
                  {/* Bio */}
                  {typeof data.bio === 'string' && data.bio.trim() !== '' && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, color: '#ff4fa3', fontWeight: 800, marginBottom: 2, fontFamily: 'Kodchasan, sans-serif' }}>About</div>
                      <div style={{ fontSize: 13, color: '#333', lineHeight: 1.35 }}>{data.bio}</div>
                    </div>
                  )}
                  {/* Stats chips */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <div style={{ padding: '4px 10px', background: '#f2ecff', color: '#6a3ecb', borderRadius: 999, fontSize: 12, fontWeight: 800 }}>{(data.courses || []).length} courses</div>
                    <div style={{ padding: '4px 10px', background: '#e6f4ea', color: '#0a3622', borderRadius: 999, fontSize: 12, fontWeight: 800 }}>{(data.friends || []).filter(f=>f.status==='accepted').length} friends</div>
                  </div>
                </div>
                {/* Action row spans both columns */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <div>
                    {info && <span style={{ fontSize: 12, opacity: 0.8 }}>{info}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { onClose && onClose(); navigate(`/u/${encodeURIComponent(username)}`); }} style={{ padding: '10px 14px', borderRadius: 999, background: '#f7f3ff', color: '#6a3ecb', border: '1px solid #e6e0f4', fontWeight: 800, boxShadow: '0 3px 0 rgba(0,0,0,0.15)' }}>View Profile</button>
                    {isSelf ? (
                      <span style={{ padding: '8px 12px', borderRadius: 999, background: '#e6f4ea', color: '#1b5e20', fontWeight: 800 }}>This is you</span>
                    ) : data.is_friend ? (
                      <span style={{ padding: '8px 12px', borderRadius: 999, background: '#e8f5e9', color: '#1b5e20', fontWeight: 800 }}>Friends</span>
                    ) : data.pending_from_other ? (
                      <span style={{ padding: '8px 12px', borderRadius: 999, background: '#fff3e0', color: '#e65100', fontWeight: 800 }}>Requested you</span>
                    ) : data.pending_from_viewer ? (
                      <span style={{ padding: '8px 12px', borderRadius: 999, background: '#fff3e0', color: '#e65100', fontWeight: 800 }}>Pending</span>
                    ) : (
                      <button onClick={() => setConfirmOpen(true)} className="clickable" style={{ padding: '10px 14px', borderRadius: 999, background: theme.palette.primary.main, color: '#fff', fontWeight: 800, border: 'none', boxShadow: '0 4px 0 rgba(0,0,0,0.2)', transition: 'transform .15s ease, box-shadow .15s ease' }} onMouseEnter={(e)=>{e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 0 rgba(0,0,0,0.25)';}} onMouseLeave={(e)=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 0 rgba(0,0,0,0.2)';}}>Send Friend Request</button>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {confirmOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 16, borderRadius: 10, width: 360 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Send Friend Request</div>
            <div style={{ marginBottom: 12, color: '#6a3ecb' }}>Are you sure you want to send a friend request to <strong style={{ color: '#6a3ecb' }}>{username}</strong>?</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setConfirmOpen(false)} style={{ padding: '8px 12px', borderRadius: 8, background: '#eee', border: '1px solid #ddd' }}>Cancel</button>
              <button disabled={sending} onClick={sendFriendRequest} style={{ padding: '8px 12px', borderRadius: 8, background: theme.palette.primary.main, color: '#fff', border: 'none', fontWeight: 700, boxShadow: '0 3px 0 rgba(0,0,0,0.2)', transition: 'transform .15s ease, box-shadow .15s ease' }} onMouseEnter={(e)=>{e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 5px 0 rgba(0,0,0,0.25)';}} onMouseLeave={(e)=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 3px 0 rgba(0,0,0,0.2)';}}>{sending ? 'Sending…' : 'Send'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
