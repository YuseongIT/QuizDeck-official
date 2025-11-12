import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from './api';
import Header from './Header';
import SidebarLeft from './SidebarLeft';
import SidebarRight from './SidebarRight';
import { CustomThemeProvider, mainContentStyles, theme, overlayStyles } from './theme';
import UserProfileModal from './UserProfileModal';
import { Box, Typography, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function Announcements() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [courses, setCourses] = useState([]);
  const [notifByAnn, setNotifByAnn] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileUser, setProfileUser] = useState('');
  const [confirmDlg, setConfirmDlg] = useState({ open:false, message:'', onYes:null });

  const isTeacher = useMemo(() => user?.role === 'teacher', [user]);
  const prettyRole = (r) => r ? r.charAt(0).toUpperCase() + r.slice(1) : '';

  const [form, setForm] = useState({ course_id: '', title: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');

  // session-aware cache keys (align with AuthContext session id policy)
  function getSessionId() {
    try { const url = new URL(window.location.href); const s = url.searchParams.get('session'); if (s && s.trim()) return s.trim(); } catch(_){}
    try { const KEY='qd_session_id'; let sid = sessionStorage.getItem(KEY); if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem(KEY, sid); } return sid; } catch(_) { return 'default'; }
  }
  const SESSION_ID = useMemo(() => getSessionId(), []);
  const ANN_KEY = useMemo(() => `qd:cache:announcements:${SESSION_ID}`, [SESSION_ID]);
  const COURSES_KEY = useMemo(() => `qd:cache:courses:list:${SESSION_ID}`, [SESSION_ID]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError('');
        // fast-path: hydrate from cache
        try { const c = localStorage.getItem(ANN_KEY); if (c) setAnnouncements(JSON.parse(c) || []); } catch(_){ }
        try { const c2 = localStorage.getItem(COURSES_KEY); if (c2) setCourses(JSON.parse(c2) || []); } catch(_){ }
        const [anns, crs, notifs] = await Promise.all([
          apiRequest('/api/announcements', { token }),
          apiRequest('/api/courses', { token }),
          apiRequest('/api/notifications', { token }).catch(() => []),
        ]);
        if (!mounted) return;
        setAnnouncements(anns || []);
        try { localStorage.setItem(ANN_KEY, JSON.stringify(anns || [])); } catch(_){ }
        setCourses(crs || []);
        try { localStorage.setItem(COURSES_KEY, JSON.stringify(crs || [])); } catch(_){ }
        const map = {};
        (Array.isArray(notifs) ? notifs : []).forEach(n => {
          const aId = n.announcement_id || n.announcementId || (n.data && n.data.announcement_id);
          if (aId) map[aId] = { id: n.id, is_read: !!(n.is_read || n.read || n.read_at) };
        });
        setNotifByAnn(map);
      } catch (e) {
        if (mounted) setError(e.message || 'Failed to load announcements');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [token]);

  async function onSave(annId) {
    if (!editTitle.trim() || !editMessage.trim()) return;
    try {
      await apiRequest(`/api/announcements/${annId}`, { method: 'PATCH', token, body: { title: editTitle.trim(), message: editMessage.trim() } });
      const anns = await apiRequest('/api/announcements', { token });
      setAnnouncements(anns || []);
      try { localStorage.setItem(ANN_KEY, JSON.stringify(anns || [])); } catch(_){}
      setEditId(null); setEditTitle(''); setEditMessage('');
      try { window.dispatchEvent(new CustomEvent('dashboard:update')); } catch(_) {}
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Announcement updated ✨' } })); } catch(_) {}
    } catch (_) {}
  }

  async function onDelete(annId) {
    setConfirmDlg({
      open:true,
      message:'Delete this announcement?',
      onYes: async () => {
        try { await apiRequest(`/api/announcements/${annId}`, { method: 'DELETE', token }); } catch(_) {}
        setAnnouncements(prev => prev.filter(x => x.id !== annId));
        try { localStorage.setItem(ANN_KEY, JSON.stringify((announcements || []).filter(x => x.id !== annId))); } catch(_){}
        try { window.dispatchEvent(new CustomEvent('dashboard:update')); } catch(_) {}
        try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Announcement deleted. Poof! 🪄' } })); } catch(_) {}
        setConfirmDlg({ open:false, message:'', onYes:null });
      }
    });
  }

  async function onCreate(e) {
    e.preventDefault();
    if (!form.course_id || !form.title.trim() || !form.message.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await apiRequest(`/api/courses/${encodeURIComponent(form.course_id)}/announcements`, { method: 'POST', token, body: { title: form.title.trim(), message: form.message.trim() } });
      // Reload announcements feed so it includes the new one with teacher/course
      const anns = await apiRequest('/api/announcements', { token });
      setAnnouncements(anns || []);
      try { localStorage.setItem(ANN_KEY, JSON.stringify(anns || [])); } catch(_){}
      setForm({ course_id: '', title: '', message: '' });
      try { window.dispatchEvent(new CustomEvent('dashboard:update')); } catch(_) {}
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Announcement posted — your students will see it shortly! 🎉' } })); } catch(_) {}
    } catch (e) {
      setError(e.message || 'Failed to post announcement');
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Could not post. Please try again.' } })); } catch(_) {}
    } finally {
      setSubmitting(false);
    }
  }

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
              <h2 style={{ margin: 0, color: '#6a3ecb' }}>Announcements</h2>
              <span style={{ padding: '6px 12px', background: theme.palette.action.main, color: '#fff', borderRadius: 999, fontWeight: 700 }}>{prettyRole(user?.role)}</span>
            </div>

            {error && <div style={{ background: '#fdecea', color: '#611a15', padding: 12, borderRadius: 8, marginBottom: 12 }}>{error}</div>}

            {isTeacher && (
              <form onSubmit={onCreate} style={{ background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: 16 }}>
                <h4 style={{ marginTop: 0 }}>Post Announcement</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
                  <select value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })} style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }}>
                    <option value="">Select course</option>
                    {courses.map(c => (<option key={c.id} value={c.id}>{c.name || c.course_name}</option>))}
                  </select>
                  <button disabled={submitting} type="submit"
                    style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid transparent', background: theme.palette.primary.main, color: '#fff', fontWeight: 700, transition: 'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease', boxShadow: '0 8px 18px rgba(108,99,255,0.18)' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = theme.palette.primary.main; e.currentTarget.style.borderColor = theme.palette.primary.main; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = theme.palette.primary.main; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                  >{submitting ? 'Posting...' : 'Post'}</button>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title" style={{ gridColumn: '1 / span 2', padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
                  <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Your announcement..." rows={3} style={{ gridColumn: '1 / span 2', padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
                </div>
              </form>
            )}

            {loading ? (
              <div className="loader-container">
                <div className="loader"></div>
                <div className="loader-text">Loading...</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {announcements.map(a => (
                  <div key={a.id} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', position: 'relative', transition: 'transform .12s ease, box-shadow .12s ease' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 22px rgba(106,62,203,0.18)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
                  >
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 6 }}>
                      <div style={{ fontWeight: 800, color: '#6a3ecb' }}>{a.course?.name || a.course?.course_name || 'Course'}</div>
                      {(!isTeacher && !(notifByAnn[a.id] && notifByAnn[a.id].is_read)) && (
                        <button
                          title="Acknowledged"
                          onClick={async () => {
                            try { await apiRequest('/api/announcements/dismiss', { method: 'POST', token, body: { ids: [a.id] } }); } catch(_) {}
                            setAnnouncements(prev => prev.filter(x => x.id !== a.id));
                            try { localStorage.removeItem(ANN_KEY); } catch(_){}
                            try { window.dispatchEvent(new CustomEvent('dashboard:update')); } catch(_) {}
                            const n = notifByAnn[a.id];
                            if (n && n.id && !n.is_read) {
                              try { await apiRequest('/api/notifications/read', { method: 'POST', token, body: { ids: [n.id] } }); } catch(_) {}
                              setNotifByAnn(prev => ({ ...prev, [a.id]: { ...(prev[a.id]||{}), is_read: true } }));
                            }
                          }}
                          style={{ marginRight: 8, border:'1px solid #e6e0f4', background:'#fff', color:'#6a3ecb', borderRadius:10, fontWeight:800, padding:'8px 12px', cursor:'pointer', transition: 'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease', boxShadow:'0 4px 10px rgba(106,62,203,0.10)' }}
                          onMouseEnter={e=>{ e.currentTarget.style.background = '#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='#6a3ecb'; e.currentTarget.style.transform='translateY(-1px) scale(1.01)'; }}
                          onMouseLeave={e=>{ e.currentTarget.style.background = '#fff'; e.currentTarget.style.color='#6a3ecb'; e.currentTarget.style.borderColor='#e6e0f4'; e.currentTarget.style.transform='none'; }}
                          onMouseDown={e=>{ e.currentTarget.style.transform='scale(0.98)'; }}
                          onMouseUp={e=>{ e.currentTarget.style.transform='translateY(-1px) scale(1.01)'; }}
                        >Acknowledge</button>
                      )}
                    </div>
                    {isTeacher && (a.teacher?.id === user?.id || a.course?.teacher_id === user?.id || a.teacher?.username === user?.username) ? (
                      <div>
                        {editId === a.id ? (
                          <div style={{ display:'grid', gap: 6 }}>
                            <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Title" style={{ padding: 8, borderRadius: 8, border: '1px solid #e6e0f4' }} />
                            <textarea value={editMessage} onChange={e => setEditMessage(e.target.value)} rows={3} placeholder="Message" style={{ padding: 8, borderRadius: 8, border: '1px solid #e6e0f4' }} />
                            <div style={{ display:'flex', gap: 8, justifyContent:'flex-end' }}>
                              <button onClick={() => onSave(a.id)}
                                style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid transparent', background: theme.palette.primary.main, color: '#fff', fontWeight: 800, transition: 'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = theme.palette.primary.main; e.currentTarget.style.borderColor = theme.palette.primary.main; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = theme.palette.primary.main; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                              >Save</button>
                              <button onClick={() => { setEditId(null); setEditTitle(''); setEditMessage(''); }}
                                style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e6e0f4', background: '#fff', color: '#6a3ecb', fontWeight: 800, transition: 'transform .12s ease, background .12s ease' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = '#f7f3ff'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = '#fff'; }}
                              >Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontWeight: 800, color: '#3e2a6d', marginBottom: 4 }}>{a.title || ''}</div>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{a.message}</div>
                            <div style={{ display:'flex', gap: 8, marginTop: 8, justifyContent:'flex-end' }}>
                              <button onClick={() => { setEditId(a.id); setEditTitle(a.title || ''); setEditMessage(a.message || ''); }}
                                style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e6e0f4', background: '#fff', color: '#6a3ecb', fontWeight: 800, transition: 'transform .12s ease, background .12s ease' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = '#f7f3ff'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = '#fff'; }}
                              >Edit</button>
                              <button onClick={() => onDelete(a.id)}
                                style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: '#e53935', color: '#fff', fontWeight: 800, transition: 'transform .12s ease, background .12s ease' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = '#d32f2f'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = '#e53935'; }}
                              >Delete</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 800, color: '#3e2a6d', marginBottom: 4 }}>{a.title || ''}</div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{a.message}</div>
                      </>
                    )}
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                      {a.teacher ? (
                        <>
                          By <span className="clickable" onClick={() => setProfileUser(a.teacher.username)} style={{ color: theme.palette.primary.main, fontWeight: 700 }}>{a.teacher.username}</span>
                        </>
                      ) : ''}
                      {a.created_at ? ` • ${new Date(a.created_at).toLocaleString()}` : ''}
                    </div>
                  </div>
                ))}
                {announcements.length === 0 && <div style={{ opacity: 0.7 }}>No announcements.</div>}
              </div>
            )}
          </div>
          <SidebarRight isOpen={isRightOpen} />
          {(isLeftOpen || isRightOpen) && (
            <div style={overlayStyles} onClick={() => { setIsLeftOpen(false); setIsRightOpen(false); }} />
          )}
        </div>
        {profileUser && (
          <UserProfileModal username={profileUser} token={token} onClose={() => setProfileUser('')} />
        )}
      </div>
      {confirmDlg.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.28)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:120 }}>
          <div style={{ width:420, maxWidth:'92vw', background:'#fff', borderRadius:16, boxShadow:'0 18px 44px rgba(0,0,0,.22)', overflow:'hidden', fontFamily:'Kodchasan, system-ui' }}>
            <div style={{ background:'#dd2680', color:'#fff', fontWeight:900, padding:'10px 14px' }}>QuizDeck</div>
            <div style={{ padding:16, fontSize:16 }}>{confirmDlg.message}</div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:16 }}>
              <button
                onClick={() => setConfirmDlg({ open:false, message:'', onYes:null })}
                style={{ padding:'10px 14px', border:'2px solid #6a3ecb', background:'#fff', color:'#6a3ecb', fontWeight:900, borderRadius:12, transition:'transform .12s ease, background .12s ease, color .12s ease, box-shadow .12s ease, border-color .12s ease' }}
                onMouseEnter={e=>{ e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 12px 24px rgba(106,62,203,.22)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#6a3ecb'; e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; }}
              >Cancel</button>
              <button
                onClick={() => { const fn=confirmDlg.onYes; if (fn) fn(); }}
                style={{ padding:'10px 14px', borderRadius:12, border:'2px solid #d9254f', background:'#d9254f', color:'#fff', fontWeight:900, transition:'transform .12s ease, background .12s ease, color .12s ease, box-shadow .12s ease, border-color .12s ease' }}
                onMouseEnter={e=>{ e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#d9254f'; e.currentTarget.style.boxShadow='0 12px 24px rgba(217,37,79,.22)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.background='#d9254f'; e.currentTarget.style.color='#fff'; e.currentTarget.style.boxShadow='none'; }}
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </CustomThemeProvider>
  );
}
