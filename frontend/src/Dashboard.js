import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Link } from 'react-router-dom';
import { apiRequest } from './api';
import CourseCard from './components/courses/CourseCard';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import SidebarLeft from './SidebarLeft';
import SidebarRight from './SidebarRight';
import Header from './Header'; // New import for the reusable Header
import QuizDetailsModal from './components/quizzes/QuizDetailsModal';
import TakeQuizModal from './components/quizzes/TakeQuizModal';
import { theme, CustomThemeProvider, mainContentStyles, overlayStyles } from './theme';
import UserProfileModal from './UserProfileModal';


const Dashboard = () => {
  const { user, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ user: null, courses: [], quizzes: [], announcements: [], activity: [] });
  const [quizViewMode, setQuizViewMode] = useState('latest'); // 'latest' | 'recent'
  const [courseViewMode, setCourseViewMode] = useState('latest'); // 'latest' | 'recent'

  const isTeacher = useMemo(() => user?.role === 'teacher', [user]);
  const prettyRole = (r) => r ? r.charAt(0).toUpperCase() + r.slice(1) : '';
  const searchRef = useRef('');
  const inputRef = useRef(null);
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [searchResults, setSearchResults] = useState({ courses: [], quizzes: [] });
  const [showFilter, setShowFilter] = useState(false);
  const [searchTypes, setSearchTypes] = useState({ courses: true, quizzes: true });
  const [visibilityFilter, setVisibilityFilter] = useState(''); // '', 'public', 'private'
  const [teacherFilter, setTeacherFilter] = useState(''); // will store teacher id as string
  const [notifByAnn, setNotifByAnn] = useState({});
  const [showQuizDetails, setShowQuizDetails] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [dismissed, setDismissed] = useState(new Set());
  const [searchLoading, setSearchLoading] = useState(false);
  const [profileUser, setProfileUser] = useState('');
  const [undoAnnId, setUndoAnnId] = useState(null);
  const undoTimerRef = useRef(null);
  const [teacherByQuiz, setTeacherByQuiz] = useState({});
  const [showTakeQuiz, setShowTakeQuiz] = useState(false);
  const hydratedQuizzesRef = useRef(new Set()); // remember which quiz IDs we already hydrated this session
  const teacherFillTimer = useRef(null);

  // Cross-tab cache of hydrated quiz ids to avoid thundering herds
  const SHARED_HYDRATED_KEY = 'qd:hydrated_quizzes';
  const readSharedHydrated = useCallback(() => {
    try {
      const raw = localStorage.getItem(SHARED_HYDRATED_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch(_) { return new Set(); }
  }, []);
  const writeSharedHydrated = useCallback((set) => {
    try {
      const arr = Array.from(set).slice(-1000);
      localStorage.setItem(SHARED_HYDRATED_KEY, JSON.stringify(arr));
    } catch(_) {}
  }, []);

  // Recently viewed quizzes utils (per-user)
  const RECENT_KEY = useMemo(() => `qd:recentQuizzes:${user?.id || 'anon'}`, [user?.id]);
  const recordQuizView = useCallback((qid) => {
    try {
      const now = Date.now();
      const raw = localStorage.getItem(RECENT_KEY);
      let arr = [];
      if (raw) arr = JSON.parse(raw);
      const map = new Map(arr.map(x => [String(x.id), x]));
      map.set(String(qid), { id: String(qid), ts: now });
      const next = Array.from(map.values()).sort((a,b)=>b.ts-a.ts).slice(0, 50);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch(_) {}
  }, [RECENT_KEY]);
  const getRecentQuizzesOrdered = useCallback(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      const byId = new Map((data.quizzes || []).map(q => [String(q.id), q]));
      return arr.map(x => byId.get(String(x.id))).filter(Boolean);
    } catch(_) { return []; }
  }, [RECENT_KEY, data.quizzes]);

  // Recently viewed courses utils (per-user)
  const RECENT_COURSES_KEY = useMemo(() => `qd:recentCourses:${user?.id || 'anon'}`, [user?.id]);
  const recordCourseView = useCallback((cid) => {
    try {
      const now = Date.now();
      const raw = localStorage.getItem(RECENT_COURSES_KEY);
      let arr = [];
      if (raw) arr = JSON.parse(raw);
      const map = new Map(arr.map(x => [String(x.id), x]));
      map.set(String(cid), { id: String(cid), ts: now });
      const next = Array.from(map.values()).sort((a,b)=>b.ts-a.ts).slice(0, 50);
      localStorage.setItem(RECENT_COURSES_KEY, JSON.stringify(next));
    } catch(_) {}
  }, [RECENT_COURSES_KEY]);
  const getRecentCoursesOrdered = useCallback(() => {
    try {
      const raw = localStorage.getItem(RECENT_COURSES_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      const byId = new Map((data.courses || []).map(c => [String(c.id), c]));
      return arr.map(x => byId.get(String(x.id))).filter(Boolean);
    } catch(_) { return []; }
  }, [RECENT_COURSES_KEY, data.courses]);

  useEffect(() => {
    let mounted = true;
    // Load dismissed announcements from localStorage per user
    try {
      const key = `qd:dismissedAnns:${user?.id || 'anon'}`;
      const raw = localStorage.getItem(key);
      if (raw) setDismissed(new Set(JSON.parse(raw)));
    } catch (_) {}
    // Restore filters per user
    try {
      const fk = `qd:dashFilters:${user?.id || 'anon'}`;
      const rawF = localStorage.getItem(fk);
      if (rawF) {
        const st = JSON.parse(rawF);
        if (st && typeof st === 'object') {
          if ('types' in st) setSearchTypes({ courses: !!st.types?.courses, quizzes: !!st.types?.quizzes });
          if ('visibility' in st) setVisibilityFilter(st.visibility || '');
          if ('teacher' in st) setTeacherFilter(st.teacher || '');
          if ('course' in st) setCourseFilter(st.course || '');
          if ('open' in st) setShowFilter(!!st.open);
        }
      }
    } catch(_){}
    async function load() {
      setLoading(true);
      setError('');
      try {
        // 1) Fast path: lite dashboard payload (no announcements/activity)
        const resLite = await apiRequest('/api/dashboard?lite=1', { token });
        let dash = resLite || { user: user ? { username: user.username, role: user.role } : null, courses: [], quizzes: [], announcements: [], activity: [] };
        // Merge in personal quizzes to appear on dashboard
        try {
          const allQuizzes = await apiRequest('/api/quizzes', { token });
          const list = Array.isArray(allQuizzes) ? allQuizzes : (Array.isArray(allQuizzes?.data) ? allQuizzes.data : []);
          const personals = list.filter(q => !q.course_id);
          const byId = new Map((Array.isArray(dash.quizzes)?dash.quizzes:[]).map(q => [String(q.id), q]));
          personals.forEach(q => { const id = String(q.id); if (!byId.has(id)) byId.set(id, q); });
          dash = { ...(dash||{}), quizzes: Array.from(byId.values()) };
        } catch(_) {}
        if (mounted) setData(dash);
        if (mounted) setLoading(false); // stop spinner after lite payload

        // 2) Lazy: announcements and activity (do not block UI)
        (async () => {
          try {
            const [anns, act] = await Promise.all([
              apiRequest('/api/announcements', { token }).catch(()=>[]),
              apiRequest('/api/activity', { token }).catch(()=>[]),
            ]);
            if (!mounted) return;
            setData(prev => ({ ...(prev||{}), announcements: Array.isArray(anns)?anns:[], activity: Array.isArray(act)?act:[] }));
          } catch(_) {}
        })();

        // 3) Notifications map (non-blocking)
        (async () => {
          try {
            const notifs = await apiRequest('/api/notifications', { token });
            const map = {};
            (Array.isArray(notifs) ? notifs : []).forEach(n => {
              let data = {}; try { data = typeof n.data === 'string' ? JSON.parse(n.data) : (n.data || {}); } catch(_) {}
              const aId = n.announcement_id || n.announcementId || data.announcement_id;
              if (aId) map[aId] = { id: n.id, is_read: !!(n.is_read || n.read || n.read_at), title: data.title };
            });
            if (mounted) setNotifByAnn(map);
          } catch (_) { if (mounted) setNotifByAnn({}); }
        })();

      } catch (e) {
        if (mounted) setError(e.message || 'Failed to load dashboard');
        if (mounted) setLoading(false);
      }
    }
    if (token) load();
    const onDash = () => { if (token) load(); };
    window.addEventListener('dashboard:update', onDash);
    return () => { mounted = false; };
  }, [token, user]);

  // Lazy fetch teacher names (and items_count) once per quiz; debounced, visibility-gated, and shared across tabs
  useEffect(() => {
    let cancelled = false;
    async function fillTeachers() {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return; // only run when tab is visible
      const processed = hydratedQuizzesRef.current;
      const shared = readSharedHydrated();
      const qs = (data.quizzes || [])
        .slice(0, 15)
        .filter(q => !processed.has(q.id) && !shared.has(q.id)); // cap and skip processed ids (session + shared)
      for (const q of qs) {
        const hasTeacher = q?.creator?.username || q?.creator_username || q?.teacher?.username || q?.course?.teacher?.username || teacherByQuiz[q.id];
        const needsItems = !(Number(q?.items_count) > 0); // fetch when missing or zero
        if (hasTeacher && !needsItems) { processed.add(q.id); shared.add(q.id); writeSharedHydrated(shared); continue; }
        try {
          const detail = await apiRequest(`/api/quiz/${q.id}`, { token });
          if (cancelled) return;
          const name = detail?.creator?.username || detail?.course?.teacher?.username || detail?.creator_username || detail?.teacher_username || detail?.teacher_name || '';
          if (name) setTeacherByQuiz(prev => ({ ...prev, [q.id]: name }));
          // Also hydrate items_count if available from detail
          const count = Array.isArray(detail?.items) ? detail.items.length : (typeof detail?.items_count === 'number' ? detail.items_count : undefined);
          if (typeof count === 'number') {
            setData(prev => ({
              ...prev,
              quizzes: (prev.quizzes || []).map(x => x.id === q.id ? { ...x, items_count: count } : x)
            }));
          }
          processed.add(q.id); shared.add(q.id); writeSharedHydrated(shared);
        } catch(_) {}
      }
    }
    if (token && (data.quizzes || []).length) {
      if (teacherFillTimer.current) clearTimeout(teacherFillTimer.current);
      const schedule = (cb) => {
        const ric = typeof window !== 'undefined' && (window.requestIdleCallback || window.requestAnimationFrame);
        if (ric) {
          ric(() => { if (!cancelled) cb(); });
        } else {
          setTimeout(() => { if (!cancelled) cb(); }, 500);
        }
      };
      teacherFillTimer.current = setTimeout(() => schedule(fillTeachers), 500); // slight delay to prioritize initial render/login flows
    }
    return () => { cancelled = true; };
  }, [token, data.quizzes]);

  // Persist filters when they change
  useEffect(() => {
    try {
      const fk = `qd:dashFilters:${user?.id || 'anon'}`;
      localStorage.setItem(fk, JSON.stringify({ types: searchTypes, visibility: visibilityFilter, teacher: teacherFilter, course: courseFilter, open: showFilter }));
    } catch(_){}
  }, [searchTypes, visibilityFilter, teacherFilter, courseFilter, showFilter, user?.id]);

  // Sync course filter from URL (?course=ID)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cf = params.get('course') || '';
    setCourseFilter(cf);
  }, [location.search]);

  const dismissAnn = async (id) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    try {
      const key = `qd:dismissedAnns:${user?.id || 'anon'}`;
      localStorage.setItem(key, JSON.stringify(Array.from(next)));
      // Show undo snackbar and delay server commit
      setUndoAnnId(id);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(async () => {
        try {
          const n = notifByAnn[id];
          if (n && n.id && !n.is_read) {
            await apiRequest('/api/notifications/read', { method: 'POST', token, body: { ids: [n.id] } });
            setNotifByAnn(prev => ({ ...prev, [id]: { ...(prev[id]||{}), is_read: true } }));
          }
          await apiRequest('/api/announcements/dismiss', { method: 'POST', token, body: { ids: [id] } });
        } catch (_) {}
        setUndoAnnId(null);
      }, 4000);
    } catch (_) {}
  };

  const undoDismiss = () => {
    if (!undoAnnId) return;
    const next = new Set(dismissed);
    next.delete(undoAnnId);
    setDismissed(next);
    try {
      const key = `qd:dismissedAnns:${user?.id || 'anon'}`;
      localStorage.setItem(key, JSON.stringify(Array.from(next)));
    } catch (_) {}
    if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
    setUndoAnnId(null);
  };

  // Server-side search for courses & quizzes when submitted
  useEffect(() => {
    let mounted = true;
    async function run() {
      const q = (submittedQuery || '').trim().toLowerCase();
      if (!q) { if (mounted) setSearchResults({ courses: [], quizzes: [] }); return; }
      try {
        setSearchLoading(true);
        const tasks = [];
        if (searchTypes.courses) tasks.push(apiRequest(`/api/search?type=course&query=${encodeURIComponent(q)}`, { token })); else tasks.push(Promise.resolve([]));
        if (searchTypes.quizzes) tasks.push(apiRequest(`/api/search?type=quiz&query=${encodeURIComponent(q)}`, { token })); else tasks.push(Promise.resolve([]));
        const [courses, quizzes] = await Promise.all(tasks);
        let cRes = courses || [];
        let qRes = quizzes || [];
        // Fallback: if API returned empty or not arrays, do a quick local filter from dashboard payload for UX
        if (!Array.isArray(cRes) || cRes.length === 0) {
          cRes = (data.courses || []).filter(c => ((c.name || c.course_name || '').toString().toLowerCase().includes(q)));
        }
        if (!Array.isArray(qRes) || qRes.length === 0) {
          qRes = (data.quizzes || []).filter(qq => ((qq.title || '').toString().toLowerCase().includes(q)));
        }
        if (mounted) setSearchResults({ courses: cRes, quizzes: qRes });
      } catch (e) {
        // On error, fallback to local matching from dashboard payload
        const cRes = (data.courses || []).filter(c => ((c.name || c.course_name || '').toString().toLowerCase().includes(q)));
        const qRes = (data.quizzes || []).filter(qq => ((qq.title || '').toString().toLowerCase().includes(q)));
        if (mounted) setSearchResults({ courses: cRes, quizzes: qRes });
      } finally {
        if (mounted) setSearchLoading(false);
      }
    }
    run();
    return () => { mounted = false; };
  }, [submittedQuery, searchTypes.courses, searchTypes.quizzes, token]);

  const toggleLeft = () => {
    setIsLeftOpen(!isLeftOpen);
    // Close the other sidebar if it's open
    if (!isLeftOpen && isRightOpen) setIsRightOpen(false);
  };

  const toggleRight = () => {
    setIsRightOpen(!isRightOpen);
    // Close the other sidebar if it's open
    if (!isRightOpen && isLeftOpen) setIsLeftOpen(false);
  };

  // Styles for the main container
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#d5ceed', 
    fontFamily: 'Kodchasan, system-ui, -apple-system, Segoe UI, Roboto, Arial',
  };

  // --- Sub-Component: Main Content ---
  const MainContent = () => (
    <div style={mainContentStyles.base}>
      <div style={{ display: 'block', width: '100%', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 14px',
              backgroundColor: theme.palette.action.main,
              color: '#fff',
              borderRadius: 999,
              fontWeight: 700,
              letterSpacing: 0.3,
              boxShadow: '0 4px 10px rgba(0,0,0,0.12)'
            }}
          >
            <span style={{ opacity: 0.9, fontWeight: 700 }}>Role:</span>
            <span style={{ fontWeight: 800 }}>
              {prettyRole(user?.role || data.user?.role || 'unknown')}
            </span>
          </span>
        </div>
      {/* Announcements moved above Search */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', padding: '8px 12px', backgroundColor: '#efe9fb', borderRadius: '12px', marginTop: 8, marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', maxWidth: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gridColumn: '1 / span 2' }}>
          <h3 style={{ margin: '0 0 12px 0', fontWeight: 700, color: '#6a3ecb' }}>Announcements</h3>
          <Link to="/announcements" style={{ fontSize: '0.9em', color: theme.palette.primary.main }}>View all</Link>
        </div>
        <div style={{ display: 'grid', gap: 10, gridColumn: '1 / span 2' }}>
          {(() => {
            const visibleAnns = (data.announcements || []).filter(a => {
              const n = notifByAnn[a.id];
              return !dismissed.has(a.id) && !(n && n.is_read);
            }).slice(0, 6);
            if (visibleAnns.length === 0) return (<div style={{ opacity: 0.7 }}>No announcements.</div>);
            return visibleAnns.map((a) => (
              <div key={a.id} onClick={() => navigate(`/course/${a.course_id || a.course?.id || ''}#announcements`)}
                style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #e6e0f4', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', transition: 'transform .14s ease, background .14s ease, box-shadow .14s ease' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)'; e.currentTarget.style.background = '#f7f3ff'; e.currentTarget.style.boxShadow = '0 10px 22px rgba(106,62,203,0.14)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6a3ecb' }} />
                <div style={{ fontFamily: 'Kodchasan, system-ui' }}>
                  <div style={{ fontWeight: 800, color: '#6a3ecb' }}>{(() => {
                    const fromNotif = (notifByAnn[a.id] && notifByAnn[a.id].title) ? String(notifByAnn[a.id].title).trim() : '';
                    const t = fromNotif || (a.title || a.announcement_title || a.header || '').toString().trim();
                    if (t) return t;
                    const m = (a.message || '').toString();
                    return m ? m.slice(0, 60) : 'Announcement';
                  })()}</div>
                  <div style={{ opacity: 0.9 }}>{(a.message || '').slice(0, 140)}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <span style={{ background: '#f7f3ff', color: '#6a3ecb', padding: '4px 10px', borderRadius: 12, fontWeight: 800, fontSize: 13, border: '1px solid #e6e0f4', maxWidth: 260, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.2, transition: 'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
                      onMouseEnter={e=>{ e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='#6a3ecb'; e.currentTarget.style.transform='translateY(-1px)'; }}
                      onMouseLeave={e=>{ e.currentTarget.style.background='#f7f3ff'; e.currentTarget.style.color='#6a3ecb'; e.currentTarget.style.borderColor='#e6e0f4'; e.currentTarget.style.transform='none'; }}
                    >{a.course?.name || a.course?.course_name || 'Course'}</span>
                    {!isTeacher && a.teacher?.username && (
                      <span style={{ background: '#eef7ff', color: '#1a73e8', padding: '4px 10px', borderRadius: 12, fontWeight: 800, fontSize: 13, border: '1px solid rgba(0,0,0,0.06)', maxWidth: 260, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.2, transition: 'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
                        onMouseEnter={e=>{ e.currentTarget.style.background='#1a73e8'; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='#1a73e8'; e.currentTarget.style.transform='translateY(-1px)'; }}
                        onMouseLeave={e=>{ e.currentTarget.style.background='#eef7ff'; e.currentTarget.style.color='#1a73e8'; e.currentTarget.style.borderColor='rgba(0,0,0,0.06)'; e.currentTarget.style.transform='none'; }}
                      >Teacher: {a.teacher.username}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</div>
                  {!isTeacher && (
                    <button onClick={(e) => { e.stopPropagation(); dismissAnn(a.id); }}
                      title="Acknowledge"
                      style={{ marginRight: 8, padding: '8px 12px', borderRadius: 10, border: '1px solid #e6e0f4', background: '#fff', color: '#6a3ecb', fontWeight: 800, fontFamily: 'Kodchasan, system-ui', cursor: 'pointer', transition: 'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease', boxShadow:'0 4px 10px rgba(106,62,203,0.10)' }}
                      onMouseEnter={e=>{ e.currentTarget.style.background = '#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='#6a3ecb'; e.currentTarget.style.transform='translateY(-1px) scale(1.01)'; }}
                      onMouseLeave={e=>{ e.currentTarget.style.background = '#fff'; e.currentTarget.style.color='#6a3ecb'; e.currentTarget.style.borderColor='#e6e0f4'; e.currentTarget.style.transform='none'; }}
                      onMouseDown={e=>{ e.currentTarget.style.transform='scale(0.98)'; }}
                      onMouseUp={e=>{ e.currentTarget.style.transform='translateY(-1px) scale(1.01)'; }}
                    >Acknowledge</button>
                  )}
                </div>
              </div>
          ));
          })()}
        </div>
      </div>
      {/* Omit global 'No results found' status for both roles */}
      </div>
      {/* Search bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', padding: '8px 12px', backgroundColor: '#fff', borderRadius: '12px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', maxWidth: '100%' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <SearchIcon sx={{ color: 'text.secondary' }} />
          <input
            type="text"
            placeholder="Search courses or quizzes..."
            defaultValue={searchRef.current}
            ref={inputRef}
            onChange={(e) => { searchRef.current = e.target.value; }}
            onKeyDown={(e) => { if (e.key === 'Enter') setSubmittedQuery((searchRef.current || '').trim()); }}
            style={{ border: 'none', padding: '10px', flexGrow: 1, outline: 'none', fontSize: '14px', fontFamily: 'Kodchasan, system-ui' }}
          />
        </div>
        <button onClick={() => setShowFilter(v => !v)}
          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid', borderColor: showFilter ? '#6a3ecb' : '#6a3ecb', background: showFilter ? '#6a3ecb' : '#fff', fontWeight: 800, fontFamily: 'Kodchasan, system-ui', color: showFilter ? '#fff' : '#6a3ecb', cursor:'pointer', transition:'transform .12s ease, box-shadow .12s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
          onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 8px 16px rgba(106,62,203,0.12)';}}
          onMouseLeave={e=>{e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none';}}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><FilterListIcon fontSize="small"/> Filter</span>
        </button>
        <button onClick={() => setSubmittedQuery((searchRef.current || '').trim())}
          style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid transparent', background: theme.palette.primary.main, color:'#fff', fontWeight: 800, fontFamily:'Kodchasan, system-ui', cursor:'pointer', boxShadow:'0 8px 18px rgba(108,99,255,0.28)', transition:'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
          onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.background='#fff'; e.currentTarget.style.color=theme.palette.primary.main; e.currentTarget.style.borderColor=theme.palette.primary.main;}}
          onMouseLeave={e=>{e.currentTarget.style.transform='none'; e.currentTarget.style.background=theme.palette.primary.main; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='transparent';}}
        >Search</button>
      </div>

      {showFilter && (
        <div style={{ background:'#fff', border:'1px solid #e6e0f4', borderRadius:12, padding:12, marginBottom:20, boxShadow:'0 8px 18px rgba(106,62,203,0.10)', fontFamily:'Kodchasan, system-ui' }}>
          <div style={{ display:'flex', gap:20, flexWrap:'wrap', alignItems:'center' }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontFamily:'Kodchasan, system-ui' }}>
              <input type="checkbox" checked={!!searchTypes.courses} onChange={e=>setSearchTypes(s=>({ ...s, courses: e.target.checked }))} style={{ accentColor: '#6a3ecb' }} /> Courses
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontFamily:'Kodchasan, system-ui' }}>
              <input type="checkbox" checked={!!searchTypes.quizzes} onChange={e=>setSearchTypes(s=>({ ...s, quizzes: e.target.checked }))} style={{ accentColor: '#6a3ecb' }} /> Quizzes
            </label>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:800, color:'#6a3ecb' }}>Quiz Course:</span>
              <select value={courseFilter} onChange={(e)=>{
                const val = e.target.value; setCourseFilter(val);
                const params = new URLSearchParams(location.search);
                if (val) params.set('course', val); else params.delete('course');
                navigate({ pathname: '/dashboard', search: params.toString() });
              }} style={{ padding:'6px 10px', borderRadius:10, border:'1px solid #e6e0f4', fontFamily:'Kodchasan, system-ui' }}>
                <option value="">All</option>
                {(data.courses || []).map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.course_name}</option>
                ))}
              </select>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:800, color:'#6a3ecb' }}>Course Visibility:</span>
              <select value={visibilityFilter} onChange={(e)=> setVisibilityFilter(e.target.value)} style={{ padding:'6px 10px', borderRadius:10, border:'1px solid #e6e0f4', fontFamily:'Kodchasan, system-ui' }}>
                <option value="">All</option>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
            {!isTeacher && (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontWeight:800, color:'#6a3ecb' }}>Teacher:</span>
                <select value={teacherFilter} onChange={(e)=> setTeacherFilter(e.target.value)} style={{ padding:'6px 10px', borderRadius:10, border:'1px solid #e6e0f4', fontFamily:'Kodchasan, system-ui' }}>
                  <option value="">All</option>
                  {Array.from(new Map((data.courses || []).map(c => [String(c.teacher?.id || c.teacher_id || ''), { id: String(c.teacher?.id || c.teacher_id || ''), label: c.teacher?.username || c.teacher_username || c.teacher_email || 'Unknown' }])).values())
                    .filter(t => t.id)
                    .map(t => (<option key={t.id} value={t.id}>{t.label}</option>))}
                </select>
              </div>
            )}
            <button onClick={()=>{ if(inputRef.current){ inputRef.current.value=''; } searchRef.current=''; setSubmittedQuery(''); setSearchResults({ courses:[], quizzes:[] }); }}
              style={{ marginLeft:'auto', padding:'8px 12px', borderRadius:10, border:'1px solid #e6e0f4', background:'#fff', color:'#6a3ecb', fontWeight:800 }}>Clear</button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#fdecea', color: '#611a15', padding: 12, borderRadius: 8, marginBottom: 12 }}>{error}</div>
      )}

      {loading ? (
        <div className="loader-container">
          <div className="loader"></div>
          <div className="loader-text">Loading...</div>
        </div>
      ) : (
        <>

          {/* Courses */}
          {searchTypes.courses && (
          <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 2px', gap: 8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h3 style={{ margin: 0, color: '#6a3ecb' }}>Courses</h3>
              <Link to="/courses" style={{ fontSize: '0.9em', color: theme.palette.primary.main, fontFamily:'Kodchasan, system-ui', fontWeight:800 }}>View all</Link>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <button onClick={()=>setCourseViewMode('latest')}
                className="qd-btn-anim"
                style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid #e6e0f4', background: courseViewMode==='latest' ? '#6a3ecb' : '#fff', color: courseViewMode==='latest' ? '#fff' : '#6a3ecb', fontWeight:800 }}>Latest</button>
              <button onClick={()=>setCourseViewMode('recent')}
                className="qd-btn-anim"
                style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid #e6e0f4', background: courseViewMode==='recent' ? '#6a3ecb' : '#fff', color: courseViewMode==='recent' ? '#fff' : '#6a3ecb', fontWeight:800 }}>Recently Viewed</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginTop: 12, marginBottom: 16 }}>
            {(() => {
              let source = [];
              if (submittedQuery && searchTypes.courses) {
                source = (searchResults.courses || []);
              } else if (courseViewMode === 'recent') {
                source = getRecentCoursesOrdered();
              } else {
                source = (data.courses || []).slice().sort((a,b)=> new Date(b.created_at||0)-new Date(a.created_at||0));
              }
              const filtered = source.filter(c => {
                const matchesVis = !visibilityFilter || (visibilityFilter === 'public' ? !!c.is_public : !c.is_public);
                const matchesTeacher = !teacherFilter || String(c.teacher?.id || c.teacher_id || '') === String(teacherFilter);
                return matchesVis && matchesTeacher;
              });
              return filtered.slice(0, 6).map(c => (
                <CourseCard key={c.id} course={c} onClick={() => { recordCourseView(c.id); navigate(`/course/${c.id}`); }} />
              ));
            })()}
            {!submittedQuery && searchTypes.courses && (data.courses || []).length === 0 && (
              isTeacher ? (
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                  <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(106,62,203,0.15)', maxWidth: 700, width: '100%', textAlign: 'center', border: '1px dashed #cab8ff' }}>
                    <div style={{ fontFamily: 'Kodchasan, system-ui', fontWeight: 800, fontSize: 20, color: '#6a3ecb', marginBottom: 8 }}>
                      Hey, you don’t have any courses yet.
                    </div>
                    <div style={{ marginTop: 8, opacity: 0.85, fontFamily: 'Kodchasan, system-ui' }}>
                      Create your first course and invite students.
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <button
                        onClick={() => navigate('/courses?create=1')}
                        className="btn-orange"
                        style={{ padding: '10px 18px' }}
                      >
                        Create Course
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ opacity: 0.7 }}>No courses yet.</div>
              )
            )}
            {submittedQuery && searchTypes.courses && !searchLoading && (searchResults.courses || []).length === 0 && <div style={{ opacity: 0.7 }}>No course matches.</div>}
          </div>
          </>
          )}

          {/* Quizzes */}
          {searchTypes.quizzes && (
          <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 2px', gap: 8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h3 style={{ margin: 0, color: '#6a3ecb' }}>Quizzes</h3>
              <Link to="/quizzes" style={{ fontSize: '0.9em', color: theme.palette.primary.main, fontFamily:'Kodchasan, system-ui', fontWeight:800 }}>View all</Link>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <button onClick={()=>setQuizViewMode('latest')}
                className="qd-btn-anim"
                style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid #e6e0f4', background: quizViewMode==='latest' ? '#6a3ecb' : '#fff', color: quizViewMode==='latest' ? '#fff' : '#6a3ecb', fontWeight:800 }}>Latest</button>
              <button onClick={()=>setQuizViewMode('recent')}
                className="qd-btn-anim"
                style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid #e6e0f4', background: quizViewMode==='recent' ? '#6a3ecb' : '#fff', color: quizViewMode==='recent' ? '#fff' : '#6a3ecb', fontWeight:800 }}>Recently Viewed</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '20px', marginTop: '12px', flexWrap: 'wrap' }}>
            {(() => {
              let source = [];
              if (submittedQuery && searchTypes.quizzes) {
                source = (searchResults.quizzes || []);
              } else if (quizViewMode === 'recent') {
                source = getRecentQuizzesOrdered();
              } else {
                // Latest by created_at desc if present
                source = (data.quizzes || []).slice().sort((a,b)=> new Date(b.created_at||0)-new Date(a.created_at||0));
              }
              const filtered = source.filter(q => (courseFilter ? String(q.course_id) === String(courseFilter) : true));
              return filtered.slice(0, 6).map((q, idx) => (
                <QuizCard key={q.id} quiz={q} isTeacher={isTeacher} onViewed={recordQuizView} color={[theme.palette.card.purple, theme.palette.card.yellow, theme.palette.card.pink][idx % 3]} />
              ));
            })()}
          </div>
          {!submittedQuery && (data.quizzes || []).length === 0 && <div style={{ opacity: 0.7 }}>No quizzes yet.</div>}
          {submittedQuery && !searchLoading && (searchResults.quizzes || []).length === 0 && <div style={{ opacity: 0.7 }}>No quiz matches.</div>}
          </>
          )}

          {/* Quizzes by those you know (students) */}
          {!isTeacher && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 2px 4px' }}>
                <h3 style={{ margin: 0, color: '#6a3ecb' }}>Quizzes by those you know</h3>
              </div>
              <div style={{ display: 'flex', gap: '20px', marginTop: '12px', flexWrap: 'wrap' }}>
                {(() => {
                  const friendsShared = (data.quizzes || []).filter(q => {
                    const isPersonal = !q.course_id;
                    const shared = !!q.is_shared;
                    const published = !!q.is_published;
                    const available = !!q.is_available;
                    const notMine = String(q.creator_id) !== String(user?.id);
                    return isPersonal && shared && published && available && notMine;
                  });
                  return friendsShared.slice(0, 6).map((q, idx) => (
                    <QuizCard key={`friend-${q.id}`} quiz={q} isTeacher={false} onViewed={recordQuizView} color={[theme.palette.card.purple, theme.palette.card.yellow, theme.palette.card.pink][idx % 3]} />
                  ));
                })()}
                {(data.quizzes || []).filter(q => !q.course_id && q.is_shared && q.is_published && q.is_available && String(q.creator_id)!==String(user?.id)).length === 0 && (
                  <div style={{ opacity: 0.7 }}>No shared quizzes from friends yet.</div>
                )}
              </div>
            </>
          )}
          

          {/* Recent Activity removed */}
        {undoAnnId && (
          <div style={{ position:'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 24, background:'#2b2340', color:'#fff', padding:'10px 14px', borderRadius:12, boxShadow:'0 10px 22px rgba(0,0,0,0.25)', display:'flex', alignItems:'center', gap:10, fontFamily:'Kodchasan, system-ui', opacity: 0.95 }}>
            <span>Announcement dismissed</span>
            <button onClick={undoDismiss} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #6a3ecb', background:'#fff', color:'#6a3ecb', fontWeight:800, cursor:'pointer' }}>Undo</button>
          </div>
        )}
        </>
      )}
    </div>
  );

  // --- Sub-Component: Quiz Card ---
  const QuizCard = ({ quiz, isTeacher, color, onViewed }) => (
    <div className="qd-card-hover qd-font" style={{ flex: '1 1 420px', minWidth: 300, maxWidth: 480, background:'linear-gradient(180deg,#faf7ff,#ffffff)', border:'1px solid #eee', borderRadius:12, color:'#1f1633', boxShadow:'0 8px 16px rgba(0,0,0,0.08)', overflow:'hidden', fontFamily:'Kodchasan, system-ui, -apple-system, Segoe UI, Roboto, Arial' }}>
      <div style={{ height:140, background:'#0f0e1a', position:'relative' }}>
        {quiz?.preview_image_url ? (
          <img alt="" src={quiz.preview_image_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        ) : (
          <div style={{ width:'100%', height:'100%', backgroundImage: `url("data:image/svg+xml,%3Csvg width='800' height='240' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='800' height='240' fill='%231b1b2f'/%3E%3Ccircle cx='80' cy='120' r='28' fill='%236a3ecb'/%3E%3Cpath d='M160 190 L320 70 L480 190 Z' fill='%23dd2680'/%3E%3C/svg%3E")`, backgroundSize:'cover', backgroundPosition:'center' }} />
        )}
      </div>
      <div style={{ padding:'12px 14px' }}>
        <div style={{ fontWeight:900, color:'#dd2680', marginBottom:6, fontSize:25, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{quiz?.title}</div>
        {quiz?.description && <div style={{ fontSize:19, opacity:.9, marginBottom:10, maxHeight:48, overflow:'hidden', textOverflow:'ellipsis' }}>{quiz.description}</div>}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12, fontSize:14 }}>
          <div style={{ display:'grid', rowGap:6 }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
              <span style={{ opacity:.75, fontWeight:800 }}>Course:</span>
              <span style={{ opacity:.9, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{quiz?.course?.name || quiz?.course?.course_name || 'Personal'}</span>
            </div>
            <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
              <span style={{ opacity:.75, fontWeight:800 }}>{!quiz?.course_id ? 'Creator:' : 'Teacher:'}</span>
              <span style={{ opacity:.9, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{
                (Number(quiz?.creator_id) === Number(user?.id) || Number(quiz?.course?.teacher_id ?? quiz?.teacher_id) === Number(user?.id))
                  ? (user?.username || 'You')
                  : (teacherByQuiz[quiz?.id] || quiz?.creator?.username || quiz?.creator_username || quiz?.creator?.name || quiz?.created_by || quiz?.created_by_name || quiz?.author || quiz?.author_username || quiz?.teacher?.username || quiz?.teacher_username || quiz?.teacher_name || quiz?.course?.teacher?.username || quiz?.course?.teacher_username || quiz?.course?.teacher_name || quiz?.creator_email || quiz?.teacher_email || 'Unknown')
              }</span>
            </div>
          </div>
          <div style={{ display:'grid', rowGap:6 }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
              <span style={{ opacity:.75, fontWeight:800 }}>Published:</span>
              <span style={{ opacity:.9 }}>{quiz?.published_at ? new Date(quiz.published_at).toLocaleDateString() : (quiz?.is_published ? (quiz?.updated_at ? new Date(quiz.updated_at).toLocaleDateString() : '—') : '—')}</span>
            </div>
            <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
              <span style={{ opacity:.75, fontWeight:800 }}>Items:</span>
              <span style={{ opacity:.9 }}>{typeof quiz?.items_count === 'number' ? quiz.items_count : 0}</span>
            </div>
          </div>
        </div>
        {(() => {
          const chips = [];
          if (quiz.visibility === 'friends') {
            chips.push(
              <span key="vis" className="qd-chip" style={{ background:'#f7f3ff', color:'#6a3ecb' }}>Friends</span>
            );
          }
          chips.push(
            quiz.is_published
              ? <span key="pub" className="qd-chip" style={{ background:'#e6f7ef', color:'#0f9d58' }}>Published</span>
              : <span key="draft" className="qd-chip" style={{ background:'#fff4e6', color:'#b26a00' }}>Draft</span>
          );
          chips.push(
            <span key="avail" className="qd-chip" style={{ background:quiz.is_available?'#eef7ff':'#fdecea', color:quiz.is_available?'#1a73e8':'#b00020' }}>{quiz.is_available?'Available':'Unavailable'}</span>
          );
          if (quiz.is_shared && !quiz.course_id) {
            chips.push(
              <span key="shared" className="qd-chip" style={{ background:'#e8f0fe', color:'#1967d2' }}>Shared</span>
            );
          }
          return (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
              {chips.filter(Boolean)}
            </div>
          );
        })()}
        <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          {(() => {
            const ownerId = quiz?.creator_id ?? quiz?.creator?.id ?? quiz?.created_by_id ?? quiz?.owner_id;
            const courseTeacherId = quiz?.course?.teacher?.id ?? quiz?.course?.teacher_id ?? quiz?.teacher_id;
            const creatorU = (quiz?.creator?.username || quiz?.creator_username || quiz?.created_by || quiz?.author || '').toString();
            const teacherU = (quiz?.teacher?.username || quiz?.teacher_username || quiz?.course?.teacher?.username || teacherByQuiz[quiz?.id] || '').toString();
            const meU = (user?.username || '').toString();
            const amOwner = !!user && (
              (ownerId != null && String(user.id) === String(ownerId)) ||
              (user.role === 'teacher' && courseTeacherId != null && String(user.id) === String(courseTeacherId)) ||
              (meU && (creatorU && creatorU.toLowerCase() === meU.toLowerCase())) ||
              (meU && (teacherU && teacherU.toLowerCase() === meU.toLowerCase()))
            );
            return (
            <>
              <button onClick={() => { if(onViewed) onViewed(quiz.id); setSelectedQuiz(quiz); setShowQuizDetails(true); }}
                className="qd-btn"
                style={{ padding:'12px 16px', fontSize:15, background:'#fcb00d', color:'#000', border:'2px solid #000', boxShadow:'0 8px 18px rgba(0,0,0,0.12)' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e0a20c'; e.currentTarget.style.boxShadow = '0 10px 22px rgba(0,0,0,0.16)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fcb00d'; e.currentTarget.style.boxShadow = '0 8px 18px rgba(0,0,0,0.12)'; }}
              >View</button>
              {amOwner ? (
                <>
                  <button onClick={() => { if(onViewed) onViewed(quiz.id); navigate(`/manage/quiz/${quiz.id}`); }}
                    className="qd-btn-anim"
                    onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#dd2680'; e.currentTarget.style.borderColor = '#dd2680'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#dd2680'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#dd2680'; }}
                    style={{ padding:'12px 16px', fontSize:15, borderRadius:12, border:'2px solid #dd2680', background:'#dd2680', color:'#fff', fontWeight:900, fontFamily:'Kodchasan, system-ui' }}
                  >Manage</button>
                  <button onClick={() => { setSelectedQuiz(quiz); setShowTakeQuiz(true); }}
                    className="qd-btn-ghost"
                    style={{ padding:'12px 16px', fontSize:15, boxShadow:'0 6px 14px rgba(0,0,0,0.10)', transition:'transform .12s ease, box-shadow .12s ease' }}
                    onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.18)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.10)'; }}
                  >Take Quiz</button>
                </>
              ) : (
                <button onClick={() => { setSelectedQuiz(quiz); setShowTakeQuiz(true); }}
                  className="qd-btn-ghost"
                  style={{ padding:'12px 16px', fontSize:15, boxShadow:'0 6px 14px rgba(0,0,0,0.10)', transition:'transform .12s ease, box-shadow .12s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.18)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.10)'; }}
                >Take Quiz</button>
              )}
            </>
          ); })()}
        </div>
      </div>
    </div>
  );

  return (
    <CustomThemeProvider>
      <div style={containerStyle}>
        <style>{`
          .qd-font { font-family: 'Kodchasan', system-ui, sans-serif; }
          .qd-chip { font-family: 'Kodchasan', system-ui, sans-serif; font-size: 13px; padding: 5px 10px; border-radius: 999px; font-weight: 800; transition: transform .12s ease; display:inline-block }
          .qd-chip:hover { transform: translateY(-1px); }
          .qd-btn { --bg:#6a3ecb; --fg:#ffffff; font-family:'Kodchasan', system-ui, sans-serif; padding: 10px 14px; border-radius: 12px; border:1px solid transparent; background: var(--bg); color: var(--fg); font-weight: 900; box-shadow: 0 4px 12px rgba(106,62,203,.16); transition: background .15s ease, color .15s ease, transform .12s ease, box-shadow .15s ease; cursor:pointer }
          .qd-btn:hover { background: var(--fg); color: var(--bg); border-color: var(--bg); box-shadow: 0 8px 18px rgba(106,62,203,.22); }
          .qd-btn:active { transform: translateY(1px); }
          .qd-btn-ghost { --bg:#6a3ecb; --fg:#6a3ecb; font-family:'Kodchasan', system-ui, sans-serif; padding: 10px 14px; border-radius:12px; border:2px solid var(--bg); background:#fff; color:var(--fg); font-weight:900; box-shadow: 0 4px 12px rgba(0,0,0,.08); transition: background .15s ease, color .15s ease, transform .12s ease, box-shadow .15s ease; cursor:pointer }
          .qd-btn-ghost:hover { background: var(--bg); color:#fff; box-shadow: 0 8px 18px rgba(106,62,203,.22); }
          .qd-btn-ghost:active { transform: translateY(1px); }
        `}</style>
        
        {/* Pass isDashboard={true} to enable toggle buttons */}
        <Header 
          isDashboard={true}
          isLeftOpen={isLeftOpen}
          isRightOpen={isRightOpen}
          toggleLeft={toggleLeft}
          toggleRight={toggleRight}
        />

        {/* Content Wrapper for fixed/overlay positioning context */}
        <div style={{ position: 'relative', flexGrow: 1 }}>
          <SidebarLeft isOpen={isLeftOpen} />
          <MainContent />
          <SidebarRight isOpen={isRightOpen} />

          {/* Overlay to dim background when a sidebar is open */}
          {(isLeftOpen || isRightOpen) && (
            <div style={overlayStyles} onClick={() => { setIsLeftOpen(false); setIsRightOpen(false); }}></div>
          )}
        </div>
        {profileUser && (
          <UserProfileModal username={profileUser} token={token} onClose={() => setProfileUser('')} />
        )}
        {showQuizDetails && selectedQuiz && (
          <QuizDetailsModal
            token={token}
            user={user}
            quiz={selectedQuiz}
            open={showQuizDetails}
            onClose={() => { setShowQuizDetails(false); setSelectedQuiz(null); }}
            onUpdated={(upd) => {
              setSelectedQuiz(upd);
              // Also update any matching quiz in dashboard payload
              setData(prev => ({
                ...prev,
                quizzes: (prev.quizzes || []).map(q => q.id === upd.id ? { ...q, ...upd } : q)
              }));
            }}
            onDeleted={(qid) => {
              setShowQuizDetails(false);
              setSelectedQuiz(null);
              setData(prev => ({ ...prev, quizzes: (prev.quizzes || []).filter(q => q.id !== qid) }));
            }}
            onPublished={(upd) => {
              setSelectedQuiz(upd);
              setData(prev => ({
                ...prev,
                quizzes: (prev.quizzes || []).map(q => q.id === upd.id ? { ...q, ...upd } : q)
              }));
            }}
            onManage={(qid) => { setShowQuizDetails(false); navigate(`/manage/quiz/${qid}`); }}
            onTake={(qid) => { setShowQuizDetails(false); setSelectedQuiz({ id: qid, ...(selectedQuiz||{}) }); setShowTakeQuiz(true); }}
          />
        )}
        {showTakeQuiz && selectedQuiz && (
          <TakeQuizModal token={token} quizId={selectedQuiz.id} onClose={() => { setShowTakeQuiz(false); }} />
        )}
      </div>
    </CustomThemeProvider>
  );
};

export default Dashboard;
