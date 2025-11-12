import React, { useEffect, useState, useCallback } from 'react';
// Assuming MUI components are available in the scope or globally
import { Box, Typography } from '@mui/material'; 
import MenuIcon from '@mui/icons-material/Menu';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { useAuth } from './AuthContext';
import { toImageUrl, API_BASE } from './api';
import { useLocation } from 'react-router-dom';

const ButtonStyle = {
    color: 'white',
    cursor: 'pointer',
    // We use a small transparent background to make the click target larger
    padding: '8px', 
    borderRadius: '50%', 
    transition: 'background-color 0.2s',
    '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.1)'
    }
};

/**
 * Reusable Header component integrated with the sidebar toggles.
 * The toggle buttons only show if isDashboard is true.
 * Additional controls:
 * - showRightGroup: show/hide DB badge and profile icon (default true)
 * - showDbStatus: show/hide DB status badge (default true)
 */
const Header = ({ isDashboard, isLeftOpen, isRightOpen, toggleLeft, toggleRight, showRightGroup = true, showDbStatus = true }) => {
    const { token, user } = useAuth() || {};
    const location = useLocation();
    const [dbStatus, setDbStatus] = useState('checking');
    const [incoming, setIncoming] = useState([]); // friend requests
    const [annNotifs, setAnnNotifs] = useState([]); // announcement notifications
    const [notifOpen, setNotifOpen] = useState(false);

    const pingDb = useCallback(async () => {
        if (!showDbStatus) return;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        try {
            setDbStatus(s => (s === 'ok' ? s : 'checking'));
            const r = await fetch(API_BASE + '/api/db-ping', { signal: controller.signal, headers: { 'Accept': 'application/json' } });
            let json = null; try { json = await r.json(); } catch(_) {}
            if (r.ok && json && json.db === 'ok') {
                setDbStatus('ok');
                return;
            }
            console.error('[DB-PING FAIL]', json || { status: r.status });
            setDbStatus('fail');
        } catch (e) {
            if (e && (e.name === 'AbortError' || (typeof e.message === 'string' && e.message.toLowerCase().includes('aborted')))) {
                // Ignore expected aborts from visibility/focus timeouts
            } else {
                console.error('[DB-PING ERROR]', e);
                setDbStatus('fail');
            }
        } finally {
            clearTimeout(timeout);
        }
    }, [showDbStatus]);

    // Ping on mount, route changes, and visibility/focus/online events; also periodic refresh
    useEffect(() => {
        if (!showDbStatus) return;
        let interval;
        pingDb();
        const onFocus = () => pingDb();
        const onVisible = () => { if (document.visibilityState === 'visible') pingDb(); };
        const onOnline = () => pingDb();
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('online', onOnline);
        // periodic refresh every 60s
        interval = setInterval(pingDb, 60000);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('online', onOnline);
            if (interval) clearInterval(interval);
        };
    }, [pingDb, showDbStatus, location.pathname]);
    useEffect(() => {
        let mounted = true;
        let interval;
        async function load() {
            if (!token) return;
            try {
                const res = await fetch(API_BASE + '/api/friends/requests', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) return;
                const json = await res.json();
                if (mounted) setIncoming((json && json.incoming_requests) || []);
            } catch (_) {}
            try {
                const nres = await fetch(API_BASE + '/api/notifications', { headers: { Authorization: `Bearer ${token}` } });
                if (nres.ok) {
                    const list = await nres.json();
                    // Only announcements, unread first
                    const anns = (Array.isArray(list) ? list : []).filter(x => x.type === 'announcement');
                    if (mounted) setAnnNotifs(anns);
                }
            } catch (_) {}
        }
        if (isDashboard) {
            load();
            interval = setInterval(load, 30000);
        }
        function onUpdate() { load(); }
        window.addEventListener('requests:update', onUpdate);
        window.addEventListener('dashboard:update', onUpdate);
        return () => { mounted = false; if (interval) clearInterval(interval); window.removeEventListener('requests:update', onUpdate); window.removeEventListener('dashboard:update', onUpdate); };
    }, [token, isDashboard]);

    async function actOnRequest(req, action) {
        // optimistic remove
        setIncoming(prev => prev.filter(r => r.id !== req.id));
        try {
            await fetch(API_BASE + `/api/friends/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ request_id: req.id })
            });
            // notify other components
            window.dispatchEvent(new CustomEvent('requests:update'));
            window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: action === 'accept' ? 'Friend request accepted.' : 'Friend request rejected.' } }));
            // fetch fresh friends and broadcast for cross-component sync
            try {
                const fres = await fetch(API_BASE + '/api/friends', { headers: { Authorization: `Bearer ${token}` }});
                if (fres.ok) {
                    const list = await fres.json();
                    window.dispatchEvent(new CustomEvent('friends:update', { detail: { friends: list } }));
                }
            } catch(_) {}
        } catch (_) {
            // rollback (re-add)
            setIncoming(prev => [req, ...prev]);
            window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: 'Failed to update friend request.' } }));
        }
    }

    return (
        <Box 
            // This Box replaces the old <header> tag and applies the styling using the theme's properties (primary.main)
            sx={{ 
                height: 64, 
                backgroundColor: 'primary.main', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', // Separates the title and buttons
                px: 3,
                position: 'sticky', 
                top: 0,
                zIndex: 300, // High zIndex to sit above sidebars/overlay
                boxShadow: 3 // Add a subtle shadow for elevation
            }}
        >
            {/* Left group: menu/back + title */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {isDashboard && (
                    <Box onClick={toggleLeft} sx={{ ...ButtonStyle, display: 'flex', alignItems: 'center' }}>
                        {isLeftOpen ? <ArrowBackIcon /> : <MenuIcon />}
                    </Box>
                )}
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'white' }}>
                    QuizDeck
                </Typography>
                {/* Role chip next to title (yellow) */}
                {user?.role && (
                  <Box
                    title={user.role}
                    sx={{
                      ml: 0.5,
                      px: 1.2,
                      py: 0.4,
                      borderRadius: 999,
                      bgcolor: '#facc15', // yellow
                      color: '#3e2a6d',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      fontSize: 12,
                      letterSpacing: 0.6,
                      boxShadow: '0 6px 14px rgba(0,0,0,0.18)',
                      transition: 'transform .12s ease, filter .12s ease',
                      '&:hover': { transform: 'translateY(-1px)', filter: 'brightness(1.05)' },
                    }}
                  >
                    {user.role}
                  </Box>
                )}
            </Box>

            {/* Right group: profile toggle */}
            {isDashboard && showRightGroup && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {showDbStatus && (
                        <>
                          {/* Inline scoped styles for the DB indicator */}
                          <style>{`
                            .reject-checkbox .checkbox-wrapper * { -webkit-tap-highlight-color: transparent; outline: none; }
                            .reject-checkbox .checkbox-wrapper input[type="checkbox"] { display: none; }
                            .reject-checkbox .checkbox-wrapper label { --size: 26px; --shadow: calc(var(--size) * 0.07) calc(var(--size) * 0.1); position: relative; display: block; width: var(--size); height: var(--size); margin: 0 auto; background-color: #4158d0; background-image: linear-gradient(43deg, #4158d0 0%, #c850c0 46%, #ffcc70 100%); border-radius: 50%; box-shadow: 0 var(--shadow) #ffbeb8; cursor: pointer; transition: 0.2s ease transform, 0.2s ease background-color, 0.2s ease box-shadow; overflow: hidden; z-index: 1; }
                            .reject-checkbox .checkbox-wrapper label:before { content: ""; position: absolute; top: 50%; right: 0; left: 0; width: calc(var(--size) * 0.7); height: calc(var(--size) * 0.7); margin: 0 auto; background-color: #fff; transform: translateY(-50%); border-radius: 50%; box-shadow: inset 0 var(--shadow) #ffbeb8; transition: 0.2s ease width, 0.2s ease height; }
                            .reject-checkbox .checkbox-wrapper label:hover:before { width: calc(var(--size) * 0.55); height: calc(var(--size) * 0.55); box-shadow: inset 0 var(--shadow) #ff9d96; }
                            .reject-checkbox .checkbox-wrapper label:active { transform: scale(0.9); }
                            .reject-checkbox .checkbox-wrapper .tick_mark { position: absolute; top: 5px; left: 1px; right: 0; width: calc(var(--size) * 0.62); height: calc(var(--size) * 0.62); margin: 0 auto; margin-left: calc(var(--size) * 0.14); transform: rotateZ(-92deg); }
                            .reject-checkbox .checkbox-wrapper .tick_mark:before, .reject-checkbox .checkbox-wrapper .tick_mark:after { content: ""; position: absolute; background-color: #fff; border-radius: 2px; opacity: 0; transition: 0.2s ease transform, 0.2s ease opacity; }
                            .reject-checkbox .checkbox-wrapper .tick_mark:before { left: 0; bottom: 0; width: calc(var(--size) * 0.1); height: calc(var(--size) * 0.3); box-shadow: -2px 0 5px rgba(0,0,0,0.23); transform: translateY(calc(var(--size) * -0.68)); }
                            .reject-checkbox .checkbox-wrapper .tick_mark:after { left: 0; bottom: 0; width: 100%; height: calc(var(--size) * 0.1); box-shadow: 0 3px 5px rgba(0,0,0,0.23); transform: translateX(calc(var(--size) * 0.78)); }
                            .reject-checkbox .checkbox-wrapper input[type="checkbox"]:checked + label { background-color: #4158d0; background-image: linear-gradient(43deg, #f7805c 0%, #fb4545 46%, #e1236a 100%); box-shadow: rgba(0,0,0,0.3) 0px 19px 38px, rgba(0,0,0,0.22) 0px 15px 12px; }
                            .reject-checkbox .checkbox-wrapper input[type="checkbox"]:checked + label:before { width: 0; height: 0; }
                            .reject-checkbox .checkbox-wrapper input[type="checkbox"]:checked + label .tick_mark:before, .reject-checkbox .checkbox-wrapper input[type="checkbox"]:checked + label .tick_mark:after { background-color: #fff; width: calc(var(--size) * 0.4); height: calc(var(--size) * 0.1); left: 50%; top: 50%; transform: translate(-50%, -50%); opacity: 1; }
                            .reject-checkbox .checkbox-wrapper input[type="checkbox"]:checked + label .tick_mark:before { transform: translate(-50%, -50%) rotate(45deg); }
                            .reject-checkbox .checkbox-wrapper input[type="checkbox"]:checked + label .tick_mark:after { transform: translate(-50%, -50%) rotate(-45deg); }
                          `}</style>
                          <div className="reject-checkbox" title={dbStatus === 'error' ? 'DB: FAIL' : dbStatus === 'ok' ? 'DB: OK' : 'DB: ...'}>
                            <div className="checkbox-wrapper">
                              <input name="ehs_approval" className="form-check-label custom-radio-label" id="Rejected" type="checkbox" readOnly checked={dbStatus === 'error'} />
                              <label htmlFor="Rejected">
                                <div className="tick_mark">
                                  <div className="cross"></div>
                                </div>
                              </label>
                            </div>
                          </div>
                        </>
                    )}
                    {/* Notifications bell */}
                    <Box onClick={() => setNotifOpen(v => !v)} sx={{ ...ButtonStyle, display: 'flex', alignItems: 'center', position: 'relative' }}>
                        <NotificationsNoneIcon sx={{ fontSize: 28 }} />
                        {((incoming?.length || 0) + (annNotifs?.filter(n=>!n.read).length || 0)) > 0 && (
                            <Box sx={{ position: 'absolute', top: 2, right: 2, backgroundColor: '#ff4d6d', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 800, px: 0.6, lineHeight: 1 }}>
                                {(incoming?.length || 0) + (annNotifs?.filter(n=>!n.read).length || 0)}
                            </Box>
                        )}
                    </Box>
                    {/* Profile toggle */}
                    <Box onClick={toggleRight} sx={{ ...ButtonStyle, display: 'flex', alignItems: 'center' }}>
                        {isRightOpen ? <ArrowBackIcon sx={{ fontSize: 38 }} /> : <AccountCircleIcon sx={{ fontSize: 40 }} />}
                    </Box>
                    {/* Dropdown */}
                    {notifOpen && (
                        <Box sx={{ position: 'absolute', right: 16, top: 64, backgroundColor: '#fff', color: '#333', borderRadius: 1.5, boxShadow: 3, p: 1.2, width: 360, zIndex: 350, fontFamily: 'Kodchasan, system-ui' }}>
                            <div style={{ fontWeight: 800, marginBottom: 8, fontFamily: 'Kodchasan, system-ui' }}>Notifications</div>
                            {(() => { const unreadAnns = annNotifs.filter(n=>!n.read); return (incoming.length === 0 && unreadAnns.length === 0); })() && <div style={{ opacity: 0.7 }}>No notifications.</div>}
                            {incoming.map(req => (
                                <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: '#f5f5f5', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {req.sender?.profile_image ? <img src={toImageUrl(req.sender.profile_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>👤</span>}
                                        </div>
                                        <div style={{ fontSize: 13 }}><strong>{req.sender?.username}</strong> sent you a friend request</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button onClick={() => actOnRequest(req, 'accept')} style={{ padding: '6px 8px', borderRadius: 6, background: '#12af59', color: '#fff', border: 'none', fontWeight: 700 }}>Accept</button>
                                        <button onClick={() => actOnRequest(req, 'reject')} style={{ padding: '6px 8px', borderRadius: 6, background: '#e53935', color: '#fff', border: 'none', fontWeight: 700 }}>Reject</button>
                                    </div>
                                </div>
                            ))}
                            {annNotifs.filter(n => !n.read).map(n => {
                                let data = {}; try { data = typeof n.data === 'string' ? JSON.parse(n.data) : (n.data || {}); } catch(_) {}
                                const ts = n.created_at ? new Date(n.created_at).toLocaleString() : '';
                                const courseLabel = data.course_name || (data.course && (data.course.name || data.course.course_name)) || (data.course_id ? `Course ${data.course_id}` : 'Course');
                                return (
                                  <div key={n.id} style={{ padding:'8px 6px', borderTop:'1px solid rgba(0,0,0,0.06)', borderRadius:8 }}>
                                    <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:10, alignItems:'start' }}>
                                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff4d6d', marginTop: 6 }} />
                                      <div style={{ fontSize: 13, cursor:'pointer', minWidth: 0 }} onClick={async () => {
                                        try { await fetch(API_BASE + '/api/notifications/read', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ ids:[n.id] }) }); } catch(_) {}
                                        setAnnNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                                        window.location.href = `/course/${data.course_id}#announcements`;
                                      }}
                                      onMouseEnter={e=>{ e.currentTarget.parentElement.parentElement.style.background='#f7f3ff'; }}
                                      onMouseLeave={e=>{ e.currentTarget.parentElement.parentElement.style.background='transparent'; }}>
                                        <div style={{ fontWeight: 800, color: '#6a3ecb', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{data.title || 'Announcement'}</div>
                                        <div style={{ opacity: 0.9, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{(data.message || '')}</div>
                                        <div style={{ display:'flex', gap:8, marginTop:6, fontSize:13, flexWrap:'wrap' }}>
                                          <span style={{ background:'#f7f3ff', color:'#6a3ecb', padding:'4px 10px', borderRadius:12, border:'1px solid #e6e0f4', display:'inline-block', maxWidth:220, whiteSpace:'normal', wordBreak:'break-word', lineHeight:1.2 }}>{courseLabel}</span>
                                          <span style={{ background:'#eef7ff', color:'#1a73e8', padding:'4px 10px', borderRadius:12, border:'1px solid rgba(0,0,0,0.06)', display:'inline-block' }}>{ts}</span>
                                        </div>
                                      </div>
                                      <button onClick={async () => {
                                        try { await fetch(API_BASE + '/api/notifications/read', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ ids:[n.id] }) }); } catch(_) {}
                                        setAnnNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                                      }} style={{ marginLeft: 8, padding:'8px 12px', borderRadius:10, border:'1px solid #e6e0f4', background:'#fff', color:'#6a3ecb', fontWeight:800, transition:'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
                                      onMouseEnter={e=>{ e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='#6a3ecb'; e.currentTarget.style.transform='translateY(-1px)'; }}
                                      onMouseLeave={e=>{ e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#6a3ecb'; e.currentTarget.style.borderColor='#e6e0f4'; e.currentTarget.style.transform='none'; }}
                                      >Acknowledge</button>
                                    </div>
                                  </div>
                                );
                            })}
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
};

export default Header;
