import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { quizzesApi, gradesApi } from '../hooks/quizzes';
import { apiRequest } from '../api';
import Header from '../Header';
import SidebarLeft from '../SidebarLeft';
import SidebarRight from '../SidebarRight';
import { CustomThemeProvider, mainContentStyles, overlayStyles, theme } from '../theme';
import { Box, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// Lazy-load heavy modals after imports to satisfy ESLint import/first
const TakeQuizModal = lazy(() => import('../components/quizzes/TakeQuizModal'));
const PreviewQuizModal = lazy(() => import('../components/quizzes/PreviewQuizModal'));
const QuizDetailsModal = lazy(() => import('../components/quizzes/QuizDetailsModal'));

export default function QuizzesPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const api = useMemo(() => quizzesApi(token), [token]);
  const gapi = useMemo(() => gradesApi(token), [token]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDlg, setConfirmDlg] = useState({ open:false, message:'', onYes: null });
  // legacy layout toggles
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);
  const [takeQuizId, setTakeQuizId] = useState(null);
  const [previewQuizId, setPreviewQuizId] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [takenSet, setTakenSet] = useState(new Set());
  // Search & filters
  const [query, setQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [courses, setCourses] = useState([]);
  // Inline create (students and teachers)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState('');
  // destination: 'private' | 'shared' | '<courseId>' (string id)
  const [dest, setDest] = useState('private');
  const [isRepeatable, setIsRepeatable] = useState(true);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [creating, setCreating] = useState(false);

  // session-aware cache keys (align with AuthContext session id policy)
  function getSessionId() {
    try {
      const url = new URL(window.location.href);
      const s = url.searchParams.get('session');
      if (s && s.trim()) return s.trim();
    } catch (_) {}
    try {
      const KEY = 'qd_session_id';
      let sid = sessionStorage.getItem(KEY);
      if (!sid) {
        sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem(KEY, sid);
      }
      return sid;
    } catch (_) { return 'default'; }
  }
  const SESSION_ID = useMemo(() => getSessionId(), []);
  const QUIZ_CACHE_KEY = useMemo(() => `qd:cache:quizzes:list:${SESSION_ID}`, [SESSION_ID]);
  const GRADES_CACHE_KEY = useMemo(() => `qd:cache:grades:list:${SESSION_ID}`, [SESSION_ID]);

  useEffect(() => {
    let mounted = true;
    const onOpenTake = (e) => setTakeQuizId(e.detail?.quizId || null);
    const onPreviewUpdated = (e) => {
      try {
        const qid = e?.detail?.quizId; const url = e?.detail?.url;
        if (!qid || !url) return;
        let changed = false;
        setQuizzes(prev => {
          const next = Array.isArray(prev) ? prev.map(q => {
            if (Number(q?.id) === Number(qid)) { changed = true; return { ...q, preview_image_url: url }; }
            return q;
          }) : prev;
          return next;
        });
        if (changed) {
          try { const cached = localStorage.getItem(QUIZ_CACHE_KEY); if (cached) {
            const arr = JSON.parse(cached) || [];
            const next = arr.map(q => (Number(q?.id) === Number(qid) ? { ...q, preview_image_url: url } : q));
            localStorage.setItem(QUIZ_CACHE_KEY, JSON.stringify(next));
          }} catch(_){}
        } else {
          // If not currently in list, do a light refresh
          (async () => { try { const list = await api.list(); setQuizzes(list||[]); try { localStorage.setItem(QUIZ_CACHE_KEY, JSON.stringify(Array.isArray(list)?list:[])); } catch(_){} } catch(_) {} })();
        }
      } catch(_) {}
    };
    window.addEventListener('openTakeQuiz', onOpenTake);
    window.addEventListener('quiz:preview:updated', onPreviewUpdated);
    // Fast-path: render from cache immediately if present
    try {
      const cachedQ = localStorage.getItem(QUIZ_CACHE_KEY);
      if (cachedQ) setQuizzes(JSON.parse(cachedQ) || []);
      const cachedG = localStorage.getItem(GRADES_CACHE_KEY);
      if (cachedG) setTakenSet(new Set((JSON.parse(cachedG) || []).map(r => Number(r.quiz_id))));
      if (cachedQ || cachedG) setLoading(false);
    } catch(_){}

    async function load() {
      try {
        if (loading) setLoading(true);
        const [data, grades] = await Promise.all([api.list(), gapi.list().catch(()=>[]) ]);
        if (!mounted) return;
        setQuizzes(data || []);
        const ids = new Set((Array.isArray(grades)?grades:[]).map(r => Number(r.quiz_id)));
        setTakenSet(ids);
        // persist caches
        try { localStorage.setItem(QUIZ_CACHE_KEY, JSON.stringify(data || [])); } catch(_){}
        try { localStorage.setItem(GRADES_CACHE_KEY, JSON.stringify(Array.isArray(grades)?grades:[])); } catch(_){}
      } catch (e) {
        if (mounted) setError(e.message || 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; window.removeEventListener('openTakeQuiz', onOpenTake); window.removeEventListener('quiz:preview:updated', onPreviewUpdated); };
  }, [api, gapi]);

  // Hydrate items_count for quizzes missing or zero so cards show correct count without full refresh
  useEffect(() => {
    let cancelled = false;
    async function fillCounts() {
      const qs = (quizzes || []).slice(0, 30);
      for (const q of qs) {
        const needs = !(Number(q?.items_count) > 0);
        if (!needs) continue;
        try {
          const detail = await api.get(q.id);
          if (cancelled) return;
          const count = Array.isArray(detail?.items) ? detail.items.length : (typeof detail?.items_count === 'number' ? detail.items_count : undefined);
          if (typeof count === 'number') {
            setQuizzes(prev => prev.map(x => x.id === q.id ? { ...x, items_count: count } : x));
          }
        } catch(_) {}
      }
    }
    if ((quizzes || []).length) fillCounts();
    return () => { cancelled = true; };
  }, [quizzes, api]);

  // Teacher: load courses for create form and filter dropdown (match logic used in CourseManagementPage)
  useEffect(() => {
    let mounted = true;
    async function loadCourses() {
      try {
        if (user?.role === 'teacher') {
          const data = await apiRequest('/api/courses', { token });
          let arr = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : (Array.isArray(data?.courses) ? data.courses : []));
          // Prefer teacher's own courses; support id or email matching similar to CourseManagementPage
          if (Array.isArray(arr) && user?.id) {
            const userEmail = (user?.email || '').toLowerCase();
            const mine = arr.filter(c => {
              const tid = c.teacher_id ?? c.owner_id ?? c.instructor_id ?? c.created_by ?? c.user_id ?? (c.teacher && (c.teacher.id || c.teacher.user_id));
              const emailMatch = (c.teacher_email || '').toLowerCase() === userEmail;
              const idMatch = String(tid) === String(user.id) || String(c?.teacher?.id || '') === String(user.id);
              return idMatch || emailMatch;
            });
            if (mine.length) arr = mine;
          }
          if (mounted) setCourses(Array.isArray(arr) ? arr : []);
        }
      } catch (_) {}
    }
    loadCourses();
    return () => { mounted = false; };
  }, [token, user?.role]);

  // For students, derive course options present in the visible quizzes list
  const studentCourses = useMemo(() => {
    const map = new Map();
    (quizzes || []).forEach(q => {
      if (q && q.course && (q.course.id || q.course_id)) {
        const id = q.course.id ?? q.course_id;
        const name = q.course.name || q.course.course_name || `Course ${id}`;
        if (!map.has(String(id))) map.set(String(id), { id, name });
      }
    });
    return Array.from(map.values());
  }, [quizzes]);

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    return (quizzes || []).filter(qz => {
      const matchesTitle = !q || (qz.title || '').toLowerCase().includes(q);
      const matchesScope = !courseFilter
        || (courseFilter === 'personal' && !qz.course_id)
        || (courseFilter === 'shared' && !qz.course_id && !!qz.is_shared)
        || (/^\d+$/.test(courseFilter) && String(qz.course_id || '') === String(courseFilter));
      return matchesTitle && matchesScope;
    });
  }, [quizzes, query, courseFilter]);

  async function createInline() {
    if (!title.trim()) { window.dispatchEvent(new CustomEvent('toast',{detail:{type:'error',message:'Enter a title'}})); return; }
    setCreating(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        visibility: 'public',
        is_repeatable: !!isRepeatable,
        is_available: true,
      };
      // derive from destination — for teachers and students
      if (dest === 'private') {
        payload.is_shared = false;
      } else if (dest === 'shared') {
        payload.is_shared = true;
      } else if (/^\d+$/.test(dest)) {
        payload.course_id = Number(dest);
      } else if (user?.role === 'teacher' && courseId) {
        // backward compat if select not migrated
        payload.course_id = Number(courseId);
      } else {
        payload.is_shared = false;
      }
      const created = await api.create(payload);
      if (imageFile && created && created.id) {
        try { const res = await api.uploadPreview(created.id, imageFile); if (res?.preview_image_url) created.preview_image_url = res.preview_image_url; } catch(_){}
      }
      setQuizzes(prev => [created, ...prev]);
      setTitle(''); setDescription(''); setCourseId(''); setDest('private'); setIsRepeatable(true); setImageFile(null); setImagePreview('');
      window.dispatchEvent(new CustomEvent('toast',{detail:{type:'success',message:'Quiz created'}}));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('toast',{detail:{type:'error',message:e.message || 'Failed to create'}}));
    } finally { setCreating(false); }
  }

  return (
    <CustomThemeProvider>
      <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', backgroundColor:'#d5ceed' }}>
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
    
    <div style={{ padding: 16 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <IconButton aria-label="Back" onClick={() => navigate(-1)} sx={{ color: theme.palette.secondary.main }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.secondary.main }}>Back</Typography>
      </Box>
      <style>{`
        .qd-font { font-family: 'Kodchasan', system-ui, sans-serif; }
        .qd-chip { font-family: 'Kodchasan', system-ui, sans-serif; font-size: 13px; padding: 5px 10px; border-radius: 999px; font-weight: 800; transition: transform .12s ease; display:inline-block }
        .qd-chip:hover { transform: translateY(-1px); }
        .qd-btn { --bg:#6a3ecb; --fg:#ffffff; font-family:'Kodchasan', system-ui, sans-serif; padding: 10px 14px; border-radius: 12px; border:2px solid var(--bg); background: var(--bg); color: var(--fg); font-weight: 900; box-shadow: 0 6px 14px rgba(106,62,203,.16); transition: background .15s ease, color .15s ease, transform .12s ease, box-shadow .15s ease, border-color .15s ease; cursor:pointer }
        .qd-btn:hover { background: var(--fg); color: var(--bg); border-color: var(--bg); box-shadow: 0 12px 24px rgba(106,62,203,.22); transform: translateY(-2px); }
        .qd-btn:active { transform: translateY(1px); }
        .qd-btn-ghost { --bg:#6a3ecb; --fg:#6a3ecb; font-family:'Kodchasan', system-ui, sans-serif; padding: 10px 14px; border-radius:12px; border:2px solid var(--bg); background:#fff; color:var(--fg); font-weight:900; box-shadow: 0 6px 14px rgba(0,0,0,.08); transition: background .15s ease, color .15s ease, transform .12s ease, box-shadow .15s ease, border-color .15s ease; cursor:pointer }
        .qd-btn-ghost:hover { background: var(--bg); color:#fff; box-shadow: 0 12px 24px rgba(106,62,203,.22); }
        .qd-btn-ghost:active { transform: translateY(1px); }
        .qd-invert { transition: all .18s ease; }
        .qd-invert:hover { background: var(--btn-hover-bg, var(--btn-fg)) !important; color: var(--btn-hover-fg, var(--btn-bg)) !important; border-color: var(--btn-hover-border, currentColor) !important; }
        .qd-icon { box-shadow: 0 10px 22px rgba(0,0,0,0.12); border-radius: 12px; }
        .qd-icon:hover { box-shadow: 0 18px 36px rgba(0,0,0,0.2); }
        .qd-input { font-family:'Kodchasan', system-ui, sans-serif; padding:12px 14px; border-radius:12px; border:1px solid #e6e0f4; outline:none; transition:border-color .12s ease, box-shadow .12s ease; }
        .qd-input:focus { border-color:#6a3ecb; box-shadow:0 0 0 3px rgba(106,62,203,.12); }
        .qd-btn-pink { --bg:#dd2680; --fg:#ffffff; }
        .qd-btn-yellow { --bg:#fcb00d; --fg:#000000; }
      `}</style>
      <div className="qd-font" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom: 12, width:'calc(100% + 32px)', marginLeft:-16, padding:'0 16px' }}>
        <h2 style={{ margin: 0, color:'#6a3ecb' }}>Quizzes</h2>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginLeft:'349px' }}>
          <input className="qd-input" placeholder={user?.role==='teacher'?'Search my quizzes':'Search quizzes'} value={query} onChange={e=>setQuery(e.target.value)} style={{ width:260 }} />
          <select className="qd-input" value={courseFilter} onChange={e=>setCourseFilter(e.target.value)} style={{ paddingRight: 28 }}>
            <option value="">All</option>
            <option value="personal">Private</option>
            <option value="shared">Shared</option>
            {(user?.role==='teacher' ? courses : studentCourses).length>0 && (
              <optgroup label="Courses">
                {(user?.role==='teacher' ? courses : studentCourses).map(c => (
                  <option key={c.id} value={String(c.id)}>{c.name || c.course_name}</option>
                ))}
              </optgroup>
            )}
          </select>
          {/* No modal trigger — inline creator only */}
        </div>
      </div>

      {/* Inline Create (visible for both students and teachers) */}
      <div className="qd-font" style={{ background:'#fff', border:'1px solid #eee', borderRadius:16, padding:24, marginBottom:20, boxShadow:'0 10px 26px rgba(0,0,0,.10)', width:'calc(100% + 32px)', margin:'0 0 20px -16px' }}>
          <div style={{ fontWeight:900, color:'#000', marginBottom:10 }}>Create Quiz</div>
          <div style={{ display:'grid', gap:12 }}>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" style={{ padding: 12, borderRadius: 10, border:'1px solid #e6e0f4', fontFamily:'Kodchasan, system-ui', fontSize:14 }} />
            <textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Description" style={{ padding: 12, borderRadius: 10, border:'1px solid #e6e0f4', fontFamily:'Kodchasan, system-ui', fontSize:14 }} />
            <div style={{ display:'grid', gap:8 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Preview image (optional)</div>
              {imagePreview && (
                <img alt="preview" src={imagePreview} style={{ width:'100%', height:200, objectFit:'contain', background:'#faf7ff', borderRadius:10, border:'1px solid #eee' }} />
              )}
              <input type="file" accept="image/*" onChange={(e)=>{ const f = e.target.files && e.target.files[0]; setImageFile(f||null); setImagePreview(f? URL.createObjectURL(f):''); }} />
            </div>
            <select value={dest} onChange={e=>setDest(e.target.value)} style={{ padding:12, borderRadius:10, border:'1px solid #e6e0f4', fontFamily:'Kodchasan, system-ui', fontSize:14 }}>
              <option value="private">Select availability: Private</option>
              <option value="shared">Shared</option>
              {user?.role==='teacher' && courses.length>0 && (
                <optgroup label="Courses">
                  {courses.map(c => (<option key={c.id} value={String(c.id)}>{c.name || c.course_name}</option>))}
                </optgroup>
              )}
            </select>
            <div style={{ display:'flex', alignItems:'center', gap:12, justifyContent:'space-between', flexWrap:'wrap' }}>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontFamily:'Kodchasan, system-ui' }}>
                <input type="checkbox" checked={isRepeatable} onChange={e=>setIsRepeatable(e.target.checked)} /> Repeatable
              </label>
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
                <button className="qd-btn qd-btn-pink" disabled={creating} onClick={createInline} style={{ padding:'10px 16px' }}>{creating ? 'Creating…' : 'Create'}</button>
              </div>
            </div>
          </div>
        </div>
      {error && <div style={{ background: '#fdecea', color: '#611a15', padding: 12, borderRadius: 8, marginBottom: 12 }}>{error}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="qd-font" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 30 }}>
          {filtered.map(q => {
            const isOwner = (
              String(user?.id || '') === String(q?.creator_id || '') ||
              String(user?.id || '') === String(q?.creator?.id || '') ||
              ((user?.username || '').toLowerCase() && (q?.creator?.username || '').toLowerCase() && (user.username||'').toLowerCase() === (q.creator.username||'').toLowerCase())
            );
            const courseName = (q?.course?.name || q?.course?.course_name) || ((courses||[]).find(c => String(c.id) === String(q?.course_id || ''))?.name || (courses||[]).find(c => String(c.id) === String(q?.course_id || ''))?.course_name) || 'Personal';
            return (
              <div key={q.id} className="qd-card-hover" style={{ background:'#fff', border:'1px solid #eee', borderRadius:12, padding:12 }}>
                {/* Header */}
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  {q.preview_image_url ? (
                    <img alt="" src={q.preview_image_url} style={{ width:52, height:52, objectFit:'cover', borderRadius:10, border:'1px solid #eee' }} />
                  ) : (
                    <div style={{ width:52, height:52, borderRadius:10, background:'#faf7ff', border:'1px solid #eee', display:'flex', alignItems:'center', justifyContent:'center', color:'#6a3ecb', fontWeight:900 }}>QZ</div>
                  )}
                  <div style={{ display:'grid', minWidth:0 }}>
                    <div style={{ fontWeight:800, color:'#6a3ecb', wordBreak:'break-word', overflowWrap:'anywhere' }}>{q.title}</div>
                    <div style={{ fontSize:15, opacity:.8, wordBreak:'break-word', overflowWrap:'anywhere' }}>{courseName} • {q.creator?.username || (isOwner ? (user?.username||'You') : 'Teacher')} • {q.created_at ? new Date(q.created_at).toLocaleDateString() : ''} • Items: {typeof q.items_count === 'number' ? q.items_count : 0}</div>
                  </div>
                </div>
                {/* Description */}
                {!!q.description && (<div style={{ fontSize:16, opacity:.9, marginBottom:8, wordBreak:'break-word', overflowWrap:'anywhere', whiteSpace:'pre-wrap' }}>{q.description}</div>)}
                {/* Labels */}
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                  {q.visibility==='friends' && (
                    <span style={{ fontSize:14, padding:'4px 8px', borderRadius:999, background:'#f7f3ff', color:'#6a3ecb', fontWeight:800 }}>Friends</span>
                  )}
                  {q.is_published ? (<span style={{ fontSize:11, padding:'4px 8px', borderRadius:999, background:'#e6f7ef', color:'#0f9d58', fontWeight:800 }}>Published</span>) : (<span style={{ fontSize:11, padding:'4px 8px', borderRadius:999, background:'#fff4e6', color:'#b26a00', fontWeight:800 }}>Draft</span>)}
                  <span style={{ fontSize:14, padding:'4px 8px', borderRadius:999, background:q.is_available?'#eef7ff':'#fdecea', color:q.is_available?'#1a73e8':'#b00020', fontWeight:800 }}>{q.is_available?'Available':'Unavailable'}</span>
                </div>
                {/* Toggles (above actions) */}
                {isOwner && (
                  <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:27, flexWrap:'wrap' }}>
                    <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <input type="checkbox" checked={!!q.is_repeatable} onChange={async (e)=>{
                        const val = e.target.checked;
                        try { const upd = await api.update(q.id, { is_repeatable: val }); setQuizzes(prev => prev.map(x => x.id===q.id? { ...x, is_repeatable: upd.is_repeatable }: x)); } catch(err){ window.dispatchEvent(new CustomEvent('toast',{detail:{type:'error',message:err.message||'Failed'}})); }
                      }} /> Repeatable
                    </label>
                    <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <input type="checkbox" checked={!!q.is_available} onChange={async ()=>{
                        try { const upd = await api.toggle(q.id); setQuizzes(prev => prev.map(x => x.id===q.id? upd : x)); } catch(err){ window.dispatchEvent(new CustomEvent('toast',{detail:{type:'error',message:err.message||'Failed'}})); }
                      }} /> Available
                    </label>
                  </div>
                )}
                {/* Actions */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, flexWrap:'wrap' }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <Tooltip title="Publish" componentsProps={{ tooltip: { sx: { fontSize: 16, padding: '10px 14px', borderRadius: 10 } } }}>
                      <IconButton
                        className="qd-icon qd-invert"
                        disabled={!!q.is_published}
                        onClick={async () => { if (q.is_published) return; try{ await api.publish(q.id); setQuizzes(prev => prev.map(x => x.id===q.id?{...x,is_published:true,status:'published'}:x)); window.dispatchEvent(new CustomEvent('toast',{detail:{type:'success',message:'Published'}})); } catch(e){ window.dispatchEvent(new CustomEvent('toast',{detail:{type:'error',message:e.message}})); } }}
                        sx={{ color:'#6a3ecb', border:'2px solid #6a3ecb', background:'#fff' }}
                        style={{ '--btn-bg':'#ffffff', '--btn-fg':'#6a3ecb' }}
                      >
                        <RocketLaunchOutlinedIcon sx={{ color:'currentColor' }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete" componentsProps={{ tooltip: { sx: { fontSize: 16, padding: '10px 14px', borderRadius: 10 } } }}>
                      <IconButton
                        className="qd-icon qd-invert"
                        onClick={() => {
                          setConfirmDlg({
                            open: true,
                            message: 'Delete this quiz and all of its items and attempts? This cannot be undone.',
                            onYes: async () => {
                              try {
                                await api.remove(q.id);
                                setQuizzes(prev => prev.filter(x => x.id !== q.id));
                                window.dispatchEvent(new CustomEvent('toast',{detail:{type:'success',message:'Quiz deleted'}}));
                              } catch(e){
                                window.dispatchEvent(new CustomEvent('toast',{detail:{type:'error',message:e.message}}));
                              } finally {
                                setConfirmDlg({ open:false, message:'', onYes:null });
                              }
                            }
                          });
                        }}
                        sx={{ color:'#d9254f', border:'2px solid #d9254f', background:'#fff' }}
                        style={{ '--btn-bg':'#ffffff', '--btn-fg':'#d9254f' }}
                      >
                        <DeleteOutlineIcon sx={{ color:'currentColor' }} />
                      </IconButton>
                    </Tooltip>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                    <button
                      className="qd-btn-anim"
                      onClick={() => { setSelectedQuiz(q); setShowDetails(true); }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#e0a20c'; e.currentTarget.style.boxShadow = '0 10px 22px rgba(0,0,0,0.16)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fcb00d'; e.currentTarget.style.boxShadow = '0 8px 18px rgba(0,0,0,0.12)'; }}
                      style={{ padding:'10px 14px', borderRadius:12, border:'2px solid #000', background:'#fcb00d', color:'#000', fontFamily:'Kodchasan, system-ui', fontWeight:900, boxShadow:'0 8px 18px rgba(0,0,0,0.12)' }}
                    >View</button>
                    {isOwner && (
                      <button
                        className="qd-btn-anim"
                        onClick={() => navigate(`/manage/quiz/${q.id}`)}
                        onMouseEnter={e => { e.currentTarget.style.background = '#dd2680'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#dd2680'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#dd2680'; e.currentTarget.style.borderColor = '#dd2680'; }}
                        style={{ padding:'10px 14px', borderRadius:12, border:'2px solid #dd2680', background:'#fff', color:'#dd2680', fontFamily:'Kodchasan, system-ui', fontWeight:900 }}
                      >Manage</button>
                    )}
                    <button
                      className="qd-btn-anim"
                      onClick={() => setTakeQuizId(q.id)}
                      onMouseEnter={e => { e.currentTarget.style.background = '#6a3ecb'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#6a3ecb'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#6a3ecb'; e.currentTarget.style.borderColor = '#6a3ecb'; }}
                      style={{ padding:'10px 14px', borderRadius:12, border:'2px solid #6a3ecb', background:'#fff', color:'#6a3ecb', fontFamily:'Kodchasan, system-ui', fontWeight:900 }}
                    >Take Quiz</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Suspense fallback={null}>
        {takeQuizId && (
          <TakeQuizModal token={token} quizId={takeQuizId} onClose={() => setTakeQuizId(null)} />
        )}
        {previewQuizId && (
          <PreviewQuizModal token={token} quizId={previewQuizId} onClose={() => setPreviewQuizId(null)} />
        )}
        {showDetails && selectedQuiz && (
          <QuizDetailsModal
            token={token}
            user={user}
            quiz={selectedQuiz}
            open={showDetails}
            onClose={() => { setShowDetails(false); setSelectedQuiz(null); }}
            onUpdated={(upd) => { setQuizzes(prev => prev.map(x => x.id === upd.id ? upd : x)); setSelectedQuiz(upd); }}
            onDeleted={(qid) => { setQuizzes(prev => prev.filter(x => x.id !== qid)); }}
            onPublished={(upd) => { setQuizzes(prev => prev.map(x => x.id === upd.id ? upd : x)); setSelectedQuiz(upd); }}
            onManage={(qid) => { setShowDetails(false); navigate(`/manage/quiz/${qid}`); }}
          />
        )}
      </Suspense>
      {confirmDlg.open && (
        <div className="qd-font" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.28)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:120 }}>
          <div style={{ width:420, maxWidth:'92vw', background:'#fff', borderRadius:16, boxShadow:'0 18px 44px rgba(0,0,0,.22)', overflow:'hidden' }}>
            <div style={{ background:'#dd2680', color:'#fff', fontWeight:900, padding:'10px 14px' }}>QuizDeck</div>
            <div style={{ padding:16, fontSize:16 }}>{confirmDlg.message}</div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:16 }}>
              <button className="qd-btn-ghost" onClick={() => setConfirmDlg({ open:false, message:'', onYes:null })} style={{ padding:'10px 14px' }}>Cancel</button>
              <button className="qd-btn" onClick={() => { const fn=confirmDlg.onYes; if (fn) fn(); }} style={{ '--bg':'#d9254f', '--fg':'#fff', padding:'10px 14px' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
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
