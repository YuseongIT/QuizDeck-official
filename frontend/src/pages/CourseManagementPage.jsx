import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../api';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiRequest, toImageUrl } from '../api';
import { quizzesApi, gradesApi, attemptsApi } from '../hooks/quizzes';
import Header from '../Header';
import SidebarLeft from '../SidebarLeft';
import SidebarRight from '../SidebarRight';
import { CustomThemeProvider, mainContentStyles, overlayStyles, theme } from '../theme';
import ImageUploader from '../components/courses/ImageUploader';
import QuizDetailsModal from '../components/quizzes/QuizDetailsModal';
import TakeQuizModal from '../components/quizzes/TakeQuizModal';
import CreateQuizModal from '../components/quizzes/CreateQuizModal';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function CourseManagementPage() {
  const { id } = useParams();
  const courseId = id; // keep as string (UUID-safe)
  const { token, user } = useAuth();
  const location = useLocation();
  const qapi = useMemo(() => quizzesApi(token), [token]);
  const gapi = useMemo(() => gradesApi(token), [token]);
  const aapi = useMemo(() => attemptsApi(token), [token]);
  const isTeacherView = user?.role === 'teacher';
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);
  const [course, setCourse] = useState(null);
  const [students, setStudents] = useState([]);
  const [classmates, setClassmates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('info');
  const [gradesQuizFilter, setGradesQuizFilter] = useState('');
  const [courseQuizzes, setCourseQuizzes] = useState([]);
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState('');
  const [gradesRows, setGradesRows] = useState([]);
  const [gLoading, setGLoading] = useState(false);
  const [gError, setGError] = useState('');
  const [takenSet, setTakenSet] = useState(new Set());
  const [openGrades, setOpenGrades] = useState({});
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [showQuizDetails, setShowQuizDetails] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [showTakeQuiz, setShowTakeQuiz] = useState(false);
  const [takeQuizId, setTakeQuizId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDlg, setConfirmDlg] = useState({ open:false, message:'', onYes:null });
  const [editForm, setEditForm] = useState({ name: '', description: '', is_public: true, course_code: '', image: null });
  const [posting, setPosting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [editAnnId, setEditAnnId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [undoAnnId, setUndoAnnId] = useState(null);
  const [lastDismissed, setLastDismissed] = useState(null);
  const undoTimerRef = useRef(null);
  const navigate = useNavigate();

  // session-aware cache helpers (align with AuthContext session id policy)
  function getSessionId() {
    try { const url = new URL(window.location.href); const s = url.searchParams.get('session'); if (s && s.trim()) return s.trim(); } catch(_) {}
    try { const KEY='qd_session_id'; let sid = sessionStorage.getItem(KEY); if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem(KEY, sid); } return sid; } catch(_) { return 'default'; }
  }
  const SESSION_ID = useMemo(() => getSessionId(), []);
  const KEY_COURSE = useMemo(() => `qd:cache:course:show:${SESSION_ID}:${courseId}`, [SESSION_ID, courseId]);
  const KEY_STUDENTS = useMemo(() => `qd:cache:course:students:${SESSION_ID}:${courseId}`, [SESSION_ID, courseId]);
  const KEY_CLASSMATES = useMemo(() => `qd:cache:course:classmates:${SESSION_ID}:${courseId}`, [SESSION_ID, courseId]);
  const KEY_QUIZZES = useMemo(() => `qd:cache:course:quizzes:${SESSION_ID}:${courseId}`, [SESSION_ID, courseId]);
  const gradesKeyFor = (quizFilter) => `qd:cache:course:grades:${SESSION_ID}:${courseId}:${quizFilter||'all'}`;

  // Refresh dashboard/course list caches after save so UI updates immediately across pages
  async function refreshPostSaveCaches() {
    const base = API_BASE;
    const teacherCoursesKey = `qd:cache:teacher:courses:${SESSION_ID}`;
    const studentMyCoursesKey = `qd:cache:student:myCourses:${SESSION_ID}`;
    const discoverKey = `qd:cache:courses:discover:${SESSION_ID}:`;
    // Fire-and-forget; swallow errors
    try {
      const res = await fetch(`${base}/api/courses`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const j = await res.json(); try { localStorage.setItem(teacherCoursesKey, JSON.stringify(Array.isArray(j)?j:[])); } catch(_){} }
    } catch(_) {}
    try {
      const res = await fetch(`${base}/api/me/courses`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const j = await res.json(); try { localStorage.setItem(studentMyCoursesKey, JSON.stringify(Array.isArray(j)?j:[])); } catch(_){} }
    } catch(_) {}
    try {
      const res = await fetch(`${base}/api/courses/public`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const j = await res.json(); try { localStorage.setItem(discoverKey, JSON.stringify(Array.isArray(j)?j:[])); } catch(_){} }
    } catch(_) {}
  }

  // Debug-friendly save handler to ensure PATCH is sent
  const handleSave = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    try {
      // Debug traces
      // eslint-disable-next-line no-console
      console.log('[DEBUG] handleSave called', { id: courseId, editForm });
      const base = API_BASE;
      const fd = new FormData();
      fd.append('_method', 'PATCH');
      fd.append('name', (editForm.name ?? '').toString());
      fd.append('is_public', editForm.is_public ? '1' : '0');
      if (editForm.description != null) fd.append('description', editForm.description);
      if (!editForm.is_public && editForm.course_code) fd.append('course_code', editForm.course_code);
      if (editForm.image instanceof File) {
        // eslint-disable-next-line no-console
        console.log('[DEBUG] attaching image', editForm.image.name, editForm.image.type, editForm.image.size);
        fd.append('image', editForm.image);
      }
      // eslint-disable-next-line no-console
      console.log('[DEBUG] sending PATCH', `${base}/api/courses/${courseId}`);
      const res = await fetch(`${base}/api/courses/${courseId}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      let json = null; try { json = await res.json(); } catch(_) {}
      // eslint-disable-next-line no-console
      console.log('[DEBUG] PATCH status:', res.status, 'payload:', json);
      if (!res.ok) throw new Error((json && json.message) || 'Failed to update');
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Course updated' } }));
      const payload = json && (json.course || json);
      if (payload) {
        const bumped = {
          ...payload,
          // Force reflect edited fields immediately in UI
          name: editForm.name || payload.name,
          course_name: editForm.name || payload.course_name,
          description: (editForm.description != null ? editForm.description : payload.description),
          is_public: !!editForm.is_public,
          image_url: payload.image_url || '',
        };
        setCourse(bumped);
        try { localStorage.setItem(KEY_COURSE, JSON.stringify(bumped)); } catch(_){}
      }
      // Ensure dashboard and lists reflect changes immediately
      try { await refreshPostSaveCaches(); } catch(_) {}
      setEditOpen(false);
      await load();
    } catch (e2) {
      // eslint-disable-next-line no-console
      console.error('[DEBUG] PATCH error:', e2);
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e2.message || 'Failed to update' } }));
    }
  };

  async function load() {
    setLoading(true);
    setError('');
    // fast-path: hydrate from cache
    try { const cached = localStorage.getItem(KEY_COURSE); if (cached) setCourse(JSON.parse(cached) || null); } catch(_){}
    if (isTeacherView) { try { const c = localStorage.getItem(KEY_STUDENTS); if (c) setStudents(JSON.parse(c) || []); } catch(_){} }
    else { try { const c = localStorage.getItem(KEY_CLASSMATES); if (c) setClassmates(JSON.parse(c) || []); } catch(_){} }
    try {
      const data = await apiRequest(`/api/courses/${courseId}?t=${Date.now()}`, { token });
      setCourse(data || null);
      try { localStorage.setItem(KEY_COURSE, JSON.stringify(data || null)); } catch(_){}
      if (data) {
        setEditForm({
          name: data.name || data.course_name || '',
          description: data.description || '',
          is_public: !!data.is_public,
          course_code: data.course_code || '',
          image: null,
        });
        if (!isTeacherView && data.enrolled) {
          try { const mates = await apiRequest(`/api/courses/${courseId}/classmates`, { token }); const arr = Array.isArray(mates) ? mates : []; setClassmates(arr); try { localStorage.setItem(KEY_CLASSMATES, JSON.stringify(arr)); } catch(_){} } catch(_) { setClassmates([]); }
        } else { setClassmates([]); }
      }
      if (isTeacherView) {
        try { const list = await apiRequest(`/api/courses/${courseId}/students`, { token }); const arr = Array.isArray(list) ? list : []; setStudents(arr); try { localStorage.setItem(KEY_STUDENTS, JSON.stringify(arr)); } catch(_){} } catch (_) {}
      }
    } catch (e) { setError(e.message || 'Failed to load course'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (token && courseId) load(); }, [token, courseId]);

  // Read query params to set default tab and quiz filter
  useEffect(() => {
    const sp = new URLSearchParams(location.search || '');
    const t = (sp.get('tab') || '').toLowerCase();
    const qid = sp.get('quiz_id') || '';
    if (t === 'grades') setTab('grades');
    if (qid) setGradesQuizFilter(String(qid));
  }, [location.search]);

  // Load course-scoped quizzes when Quizzes tab is opened
  useEffect(() => {
    let mounted = true;
    async function loadQuizzes() {
      if (tab !== 'quizzes') return;
      try { const cached = localStorage.getItem(KEY_QUIZZES); if (cached) setCourseQuizzes(JSON.parse(cached) || []); } catch(_){}
      try {
        setQLoading(true); setQError('');
        const [list, myGrades] = await Promise.all([
          qapi.byCourse(courseId),
          (user?.role === 'student' ? gapi.list().catch(()=>[]) : Promise.resolve([]))
        ]);
        if (!mounted) return;
        const arr = Array.isArray(list) ? list : [];
        setCourseQuizzes(arr);
        try { localStorage.setItem(KEY_QUIZZES, JSON.stringify(arr)); } catch(_){}
        if (user?.role === 'student') {
          const ids = new Set(((Array.isArray(myGrades) ? myGrades : [])).map(r => Number(r.quiz_id)));
          setTakenSet(ids);
        } else {
          setTakenSet(new Set());
        }
      } catch (e) { if (mounted) setQError(e.message || 'Failed to load quizzes'); }
      finally { if (mounted) setQLoading(false); }
    }
    loadQuizzes();
    return () => { mounted = false; };
  }, [tab, courseId, qapi]);

  // Load grades (then filter by course and optional quiz) when Grades tab is opened
  useEffect(() => {
    let mounted = true;
    async function loadGrades() {
      if (tab !== 'grades') return;
      const GK = gradesKeyFor(gradesQuizFilter);
      try { const cached = localStorage.getItem(GK); if (cached) setGradesRows(JSON.parse(cached) || []); } catch(_){}
      try {
        setGLoading(true); setGError('');
        const rows = await gapi.list();
        if (!mounted) return;
        let filtered = Array.isArray(rows) ? rows.filter(r => String(r.course_id || '') === String(courseId)) : [];
        if (gradesQuizFilter) {
          filtered = filtered.filter(r => String(r.quiz_id || '') === String(gradesQuizFilter));
        }
        setGradesRows(filtered);
        try { localStorage.setItem(GK, JSON.stringify(filtered)); } catch(_){}
      } catch (e) { if (mounted) setGError(e.message || 'Failed to load grades'); }
      finally { if (mounted) setGLoading(false); }
    }
    loadGrades();
    return () => { mounted = false; };
  }, [tab, courseId, gradesQuizFilter, gapi]);

  async function removeStudent(uid) {
    if (!window.confirm('Remove this student from the course?')) return;
    try {
      await apiRequest(`/api/courses/${courseId}/students/${uid}`, { method: 'DELETE', token });
      setStudents(prev => prev.filter(s => s.id !== uid));
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Removed from course' } }));
    } catch (e) { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to remove' } })); }
  }

  async function removeAttempt(attemptId) {
    if (!attemptId) return;
    setConfirmDlg({
      open: true,
      message: 'Remove this grade record? This deletes the attempt.',
      onYes: async () => {
        try {
          await aapi.remove(attemptId);
          setGradesRows(prev => prev.filter(r => String(r.attempt_id) !== String(attemptId)));
          try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Record removed' } })); } catch(_) {}
        } catch (e) {
          window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to remove' } }));
        } finally {
          setConfirmDlg({ open:false, message:'', onYes:null });
        }
      }
    });
  }

  async function postAnnouncement() {
    if (!newTitle.trim() || !newAnnouncement.trim()) {
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: 'Please enter a title and message.' } }));
      return;
    }
    setPosting(true);
    try {
      await apiRequest(`/api/courses/${courseId}/announcements`, { method: 'POST', token, body: { title: newTitle.trim(), message: newAnnouncement.trim() } });
      setNewAnnouncement(''); setNewTitle('');
      await load();
      try { window.dispatchEvent(new CustomEvent('dashboard:update')); } catch(_) {}
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Announcement posted' } }));
      try { localStorage.removeItem(KEY_COURSE); } catch(_){}
    } catch (e) { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to post' } })); }
    finally { setPosting(false); }
  }
  async function deleteAnnouncement(aid) {
    setConfirmDlg({
      open:true,
      message:'Delete this announcement?',
      onYes: async () => {
        try {
          await apiRequest(`/api/announcements/${aid}`, { method: 'DELETE', token });
          await load();
          try { window.dispatchEvent(new CustomEvent('dashboard:update')); } catch(_) {}
          window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Announcement deleted' } }));
          try { localStorage.removeItem(KEY_COURSE); } catch(_){}
        } catch (e) {
          const msg = e?.message || '';
          if (msg.includes('No query results for model') || msg.includes('not found') || msg.includes('404')) {
            setCourse(prev => ({ ...prev, announcements: (prev.announcements || []).filter(x => x.id !== aid) }));
            window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'info', message: 'Announcement already removed. UI updated.' } }));
          } else {
            window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: msg || 'Failed to delete' } }));
          }
        } finally {
          setConfirmDlg({ open:false, message:'', onYes:null });
        }
      }
    });
  }
  async function saveAnnouncement(aid) {
    if (!editTitle.trim() || !editMessage.trim()) {
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: 'Please enter a title and message.' } }));
      return;
    }
    try {
      await apiRequest(`/api/announcements/${aid}`, { method: 'PATCH', token, body: { title: editTitle.trim(), message: editMessage.trim() } });
      setEditAnnId(null); setEditTitle(''); setEditMessage('');
      await load();
      try { window.dispatchEvent(new CustomEvent('dashboard:update')); } catch(_) {}
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Announcement updated' } }));
      try { localStorage.removeItem(KEY_COURSE); } catch(_){}
    } catch (e) {
      const msg = e?.message || '';
      if (msg.includes('No query results for model') || msg.includes('not found') || msg.includes('404')) {
        setEditAnnId(null); setEditTitle(''); setEditMessage('');
        setCourse(prev => ({ ...prev, announcements: (prev.announcements || []).filter(x => x.id !== aid) }));
        window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'info', message: 'Announcement no longer exists. It has been removed from the list.' } }));
      } else {
        window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: msg || 'Failed to update' } }));
      }
    }
  }
  async function deleteCourse() {
    try {
      const base = (process.env.REACT_APP_API_BASE || 'http://127.0.0.1:8000');
      const res = await fetch(`${base}/api/courses/${courseId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      let json = null; try { json = await res.json(); } catch(_) {}
      if (!res.ok) throw new Error((json && json.message) || 'Failed to delete course');
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Course deleted' } }));
      navigate('/dashboard');
      try { localStorage.removeItem(KEY_COURSE); localStorage.removeItem(KEY_STUDENTS); localStorage.removeItem(KEY_CLASSMATES); localStorage.removeItem(KEY_QUIZZES); } catch(_){}
    } catch (e) {
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to delete' } }));
    }
  }

  const containerStyle = { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#d5ceed', fontFamily: 'Kodchasan, system-ui' };
  const chip = (text, bg, fg) => (
    <span
      style={{
        background: bg,
        color: fg,
        padding: '4px 10px',
        borderRadius: 12,
        fontWeight: 800,
        fontSize: 16,
        border: '1px solid rgba(0,0,0,0.06)',
        transition: 'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease'
      }}
      onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.background=fg; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor=fg; }}
      onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.background=bg; e.currentTarget.style.color=fg; e.currentTarget.style.borderColor='rgba(0,0,0,0.06)'; }}
    >{text}</span>
  );
  const Skeleton = ({ h = 16, w = '100%', br = 8, mt = 0 }) => (
    <div style={{ height: h, width: w, marginTop: mt, borderRadius: br, background: 'linear-gradient(90deg,#eee,#f5f5f5,#eee)', backgroundSize: '200% 100%', animation: 'qd-skel 1.3s infinite' }} />
  );

  return (
    <>
    <CustomThemeProvider>
      <div style={containerStyle}>
        <style>{`
          .qd-big-pink { transform: scale(1.35); accent-color: #dd2680; cursor: pointer; }
          .qd-lock .lock-input { display: none; }
          .qd-lock .lock-label { width: 32px; height: 32px; display:flex; align-items:center; justify-content:center; background-color: rgb(80,80,80); border-radius: 10px; cursor: pointer; transition: all .3s; }
          .qd-lock .lock-wrapper { width: fit-content; height: fit-content; display:flex; flex-direction: column; align-items:center; justify-content:center; transform: rotate(-10deg); }
          .qd-lock .shackle { background-color: transparent; height: 8px; width: 12px; border-top-right-radius: 10px; border-top-left-radius: 10px; border-top: 2px solid white; border-left: 2px solid white; border-right: 2px solid white; transition: all .3s; }
          .qd-lock .lock-body { width: 12px; }
          .qd-lock .lock-input:checked + .lock-label .lock-wrapper .shackle { transform: rotateY(150deg) translateX(2px); transform-origin: right; }
          .qd-lock .lock-input:checked + .lock-label { background-color: rgb(167, 71, 245); }
          .qd-lock .lock-label:active { transform: scale(0.92); }
        `}</style>
        <Header isDashboard={true} isLeftOpen={isLeftOpen} isRightOpen={isRightOpen} toggleLeft={() => setIsLeftOpen(p => !p)} toggleRight={() => setIsRightOpen(p => !p)} />
        <div style={{ position: 'relative', flexGrow: 1 }}>
          <SidebarLeft isOpen={isLeftOpen} />
          <div style={mainContentStyles.base}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <IconButton aria-label="Back" onClick={() => navigate(-1)} sx={{ color: theme.palette.secondary.main }}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.secondary.main }}>Back</Typography>
            </Box>
            {error && <div style={{ background: '#fdecea', color: '#611a15', padding: 12, borderRadius: 8, marginBottom: 12 }}>{error}</div>}
            {loading ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Skeleton h={140} w={220} br={12} />
                  <div style={{ flex: 1 }}>
                    <Skeleton h={22} w={'45%'} />
                    <Skeleton h={14} w={'80%'} mt={8} />
                    <Skeleton h={14} w={'60%'} mt={6} />
                  </div>

                {/* CreateQuizModal should not render only during loading */}
                </div>
                <Skeleton h={32} w={'30%'} />
                <Skeleton h={120} />
              </div>
            ) : course ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 320, height: 200, background: '#faf7ff', borderRadius: 16, overflow: 'hidden', border: '1px solid #eee', boxShadow: '0 10px 22px rgba(0,0,0,0.10)' }}>
                    {course.image_url ? (
                      <img
                        alt=""
                        src={toImageUrl(course.image_url)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e)=>{
                          try {
                            const el = e.currentTarget;
                            const src = String(el.src || '');
                            // Retry once without query params if present
                            if (src.includes('?')) {
                              const noQ = src.split('?')[0];
                              el.onerror = null; // avoid loops
                              el.src = noQ;
                              return;
                            }
                          } catch(_) {}
                          // Fallback: show placeholder if retry fails
                          e.currentTarget.replaceWith(Object.assign(document.createElement('div'), { style: 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#6a3ecb;background:repeating-linear-gradient(45deg,#f7f3ff,#f7f3ff 10px,#fff 10px,#fff 20px)' , innerText: 'No image' }));
                        }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6a3ecb', background: 'repeating-linear-gradient(45deg,#f7f3ff,#f7f3ff 10px,#fff 10px,#fff 20px)' }}>No image</div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 900, fontSize: 30, color: '#3e2a6d' }}>{course.name || course.course_name}</div>
                      {chip(course.is_public ? 'Public' : 'Private', course.is_public ? '#e6f7ef' : '#fff4e6', course.is_public ? '#0f9d58' : '#b26a00')}
                    </div>
                    <div style={{ opacity: 0.85, marginTop: 6 }}>{course.description || ''}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {chip(`Students: ${course.students_count ?? 0}`, '#f7f3ff', '#6a3ecb')}
                      {chip(`Quizzes: ${course.quizzes_count ?? 0}`, '#fff6e6', '#b26a00')}
                      {chip(`Teacher: ${course.teacher?.username || course.teacher_email || 'Unknown'}`,'#eef7ff','#1a73e8')}
                    </div>
                    {(isTeacherView && ((Number(user?.id) === Number(course?.teacher_id)) || (Number(user?.id) === Number(course?.teacher?.id)) || ((user?.email || '').toLowerCase() === (course?.teacher_email || '').toLowerCase()))) && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button className="qd-btn-anim"
                          onClick={() => setEditOpen(true)}
                          style={{ padding: '10px 14px', borderRadius: 12, border: 'none', background: theme.palette.primary.main, color: '#fff', fontWeight: 800, fontFamily:'Kodchasan, system-ui', boxShadow: '0 10px 20px rgba(108,99,255,0.28)', transition: 'transform .12s ease, background .12s ease' }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#6a3ecb'; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = theme.palette.primary.main; }}
                        >Edit Course</button>
                        <button className="qd-btn-anim"
                          onClick={() => setConfirmDlg({ open:true, message:'This will permanently delete this course and related data (enrollments, announcements, quizzes, images). Continue?', onYes: async ()=>{ try{ await deleteCourse(); } finally { setConfirmDlg({ open:false, message:'', onYes:null }); } } })}
                          style={{ padding: '10px 14px', borderRadius: 12, border: 'none', background: '#e53935', color: '#fff', fontWeight: 800, fontFamily:'Kodchasan, system-ui', boxShadow: '0 10px 20px rgba(229,57,53,0.22)', transition: 'transform .12s ease, background .12s ease' }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#d32f2f'; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = '#e53935'; }}
                        >Delete Course</button>
                      </div>
                    )}
                    {!isTeacherView && course?.enrolled && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button className="qd-btn-anim"
                          onClick={() => setConfirmDlg({ open:true, message:'Leave this course?', onYes: async () => { try { await apiRequest(`/api/courses/${courseId}/leave`, { method: 'POST', token }); window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Left course' } })); await load(); try { window.dispatchEvent(new CustomEvent('courses:update')); window.dispatchEvent(new CustomEvent('dashboard:update')); } catch(_) {} } catch (e) { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to leave' } })); } finally { setConfirmDlg({ open:false, message:'', onYes:null }); } } })}
                          style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid #e6e0f4', background: '#fff', color: '#e53935', fontWeight: 800, fontFamily: 'Kodchasan, system-ui', boxShadow: '0 8px 18px rgba(229,57,53,0.15)', transition: 'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#e53935'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#d32f2f'; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#e53935'; e.currentTarget.style.borderColor = '#e6e0f4'; }}
                        >Leave Course</button>
                      </div>
                    )}
                    {!isTeacherView && !course?.enrolled && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        {course?.is_public ? (
                          <button className="qd-btn-anim"
                            disabled={joining}
                            onClick={() => { setJoining(true); apiRequest(`/api/courses/${courseId}/join`, { method: 'POST', token }).then(() => { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Joined course' } })); load(); try { window.dispatchEvent(new CustomEvent('courses:update')); window.dispatchEvent(new CustomEvent('dashboard:update')); } catch(_) {} }).catch(e => { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to join' } })); }).finally(() => { setJoining(false); }); }}
                            style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid transparent', background: theme.palette.primary.main, color: '#fff', fontWeight: 800, fontFamily: 'Kodchasan, system-ui', boxShadow: '0 8px 18px rgba(108,99,255,0.28)', transition: 'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = theme.palette.primary.main; e.currentTarget.style.borderColor = theme.palette.primary.main; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = theme.palette.primary.main; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                          >{joining ? 'Joining…' : 'Join Course'}</button>
                        ) : (
                          <>
                            <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Enter course code" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e0f4', fontFamily: 'Kodchasan, system-ui' }} />
                            <button className="qd-btn-anim"
                              disabled={joining || !joinCode.trim()}
                              onClick={async () => {
                                if (!joinCode.trim()) return;
                                setJoining(true);
                                try {
                                  await apiRequest(`/api/courses/${encodeURIComponent(joinCode.trim())}/join`, { method: 'POST', token });
                                  window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Joined course' } }));
                                  await load();
                                  try { window.dispatchEvent(new CustomEvent('courses:update')); window.dispatchEvent(new CustomEvent('dashboard:update')); } catch(_) {}
                                } catch (e) {
                                  window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to join' } }));
                                } finally { setJoining(false); }
                              }}
                              style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid transparent', background: theme.palette.primary.main, color: '#fff', fontWeight: 800, fontFamily: 'Kodchasan, system-ui', boxShadow: '0 8px 18px rgba(108,99,255,0.28)', transition: 'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
                              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = theme.palette.primary.main; e.currentTarget.style.borderColor = theme.palette.primary.main; }}
                              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = theme.palette.primary.main; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                            >Join</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap:'wrap' }}>
                  {['info', ...(isTeacherView ? ['students'] : []), 'announcements', 'quizzes', 'grades'].map(key => (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className="qd-btn-anim"
                      style={{ padding: '10px 14px', borderRadius: 999, border: '1px solid #e6e0f4', background: tab===key?'#6a3ecb':'#fff', color: tab===key?'#fff':'#1f1633', fontWeight: 900, fontFamily:'Kodchasan, system-ui', transition: 'transform .12s ease, background .12s ease, color .12s ease', boxShadow: tab===key?'0 10px 20px rgba(106,62,203,0.20)':'none' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                    >{key === 'info' ? 'Course Information' : key === 'students' ? 'Manage Students' : key === 'announcements' ? 'Announcements' : key === 'quizzes' ? 'Quizzes' : 'Grades'}</button>
                  ))}
                </div>

                {tab === 'info' && (
                  <div style={{ padding: 8 }}>
                    <div className="qd-card-hover" style={{ background:'#fff', border:'1px solid #eee', borderRadius:12, padding:16, marginBottom:16 }}>
                      <div style={{ fontWeight:900, color:'#3e2a6d', marginBottom:8, fontSize:22 }}>Course Information</div>
                      <div style={{ marginBottom:8, fontSize:18 }}><strong>Name:</strong> {course?.name || course?.course_name}</div>
                      <div style={{ marginBottom:8, fontSize:18 }}><strong>Description:</strong> {course?.description || '—'}</div>
                      <div style={{ marginBottom:8, fontSize:18 }}><strong>Teacher:</strong> {course?.teacher?.username || course?.teacher_email || 'Unknown'}</div>
                      <div style={{ fontSize:18 }}><strong>Created:</strong> {course?.created_at ? new Date(course.created_at).toLocaleString() : '—'}</div>
                    </div>
                    <div className="qd-card-hover" style={{ background:'#fff', border:'1px solid #eee', borderRadius:12, padding:16, marginBottom:16 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                        <div style={{ fontWeight:900, color:'#3e2a6d', fontSize:25 }}>Enrolled Students</div>
                        <div style={{ fontSize:15, background:'#f7f3ff', color:'#6a3ecb', border:'1px solid #e6e0f4', padding:'4px 10px', borderRadius:999, fontWeight:800 }}>
                          Total: {isTeacherView ? (students?.length || 0) : (classmates?.length || 0)}
                        </div>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:10 }}>
                        {(isTeacherView ? (students||[]) : (classmates||[])).map(s => (
                          <div key={s.id} className="qd-card-hover" onClick={() => { if (!isTeacherView) navigate(`/u/${encodeURIComponent(s.username || '')}`); }} style={{ display:'flex', alignItems:'center', gap:10, background:'#fff', border:'1px solid #eee', borderRadius:12, padding:10, cursor: (!isTeacherView ? 'pointer' : 'default') }}>
                            <div style={{ width:38, height:38, borderRadius:'50%', overflow:'hidden', background:'#faf7ff', border:'1px solid #e6e0f4', flex:'0 0 auto' }}>
                              {s.profile_image ? (
                                <img src={toImageUrl(s.profile_image)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                              ) : (
                                <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#6a3ecb', fontWeight:900 }}>
                                  {(s.username || s.name || 'U').charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div style={{ display:'grid' }}>
                              <div style={{ fontWeight:800, fontSize:20 }}>{s.username || s.name}</div>
                              <div style={{ fontSize:15, opacity:.7 }}>{s.role}</div>
                            </div>
                          </div>
                        ))}
                        {((isTeacherView ? (students?.length||0) : (classmates?.length||0)) === 0) && (
                          <div style={{ opacity:.7 }}>{isTeacherView ? 'No students enrolled yet.' : 'No classmates yet.'}</div>
                        )}
                      </div>
                    </div>
                  </div>
              )}

                {tab === 'quizzes' && (
                  <div style={{ padding: 8 }}>
                    <div style={{ background:'#fff', border:'1px solid #eee', borderRadius:16, padding:16 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                        <div style={{ fontWeight:900, fontSize:25, color:'#3e2a6d' }}>Course Quizzes</div>
                        {isTeacherView && (
                          <button className="qd-btn-anim" onClick={() => setShowCreateQuiz(true)} style={{ padding:'12px 18px', borderRadius:12, border:'1px solid transparent', background: '#dd2680', color:'#fff', fontWeight:900, fontFamily:'Kodchasan, system-ui', fontSize:20, boxShadow:'0 10px 24px rgba(221,38,128,0.28)' }}>Create Quiz</button>
                        )}
                      </div>
                      {qError && <div style={{ background:'#eaebfdff', color:'#611a15', padding:10, borderRadius:8, marginBottom:8 }}>{qError}</div>}
                      {qLoading ? (
                        <div>Loading…</div>
                      ) : (
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:12 }}>
                          {courseQuizzes.map(q => (
                            <div key={q.id} className="qd-card-hover" style={{ background:'#fff', border:'2px solid #6a3ecb', borderRadius:12, padding:12 }}>
                              {/* Header */}
                              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                                {q.preview_image_url ? (
                                  <img alt="" src={q.preview_image_url} style={{ width:52, height:52, objectFit:'cover', borderRadius:10, border:'1px solid #eee' }} />
                                ) : (
                                  <div style={{ width:52, height:52, borderRadius:10, background:'#faf7ff', border:'1px solid #eee', display:'flex', alignItems:'center', justifyContent:'center', color:'#6a3ecb', fontWeight:900 }}>QZ</div>
                                )}
                                <div style={{ display:'grid' }}>
                                  <div style={{ fontWeight:800, color:'#6a3ecb' }}>{q.title}</div>
                                  <div style={{ fontSize:15, opacity:.8 }}>{q.course?.name || q.course?.course_name || 'Personal'} • {q.creator?.username || 'Teacher'} • {q.created_at ? new Date(q.created_at).toLocaleDateString() : ''}</div>
                                </div>
                              </div>
                              {/* Description */}
                              {!!q.description && (<div style={{ fontSize:16, opacity:.9, marginBottom:8 }}>{q.description}</div>)}
                              {/* Labels */}
                              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                                {q.visibility==='friends' && (
                                  <span style={{ fontSize:14, padding:'4px 8px', borderRadius:999, background:'#f7f3ff', color:'#6a3ecb', fontWeight:800 }}>Friends</span>
                                )}
                                {q.is_published ? (<span style={{ fontSize:11, padding:'4px 8px', borderRadius:999, background:'#e6f7ef', color:'#0f9d58', fontWeight:800 }}>Published</span>) : (<span style={{ fontSize:11, padding:'4px 8px', borderRadius:999, background:'#fff4e6', color:'#b26a00', fontWeight:800 }}>Draft</span>)}
                                <span style={{ fontSize:14, padding:'4px 8px', borderRadius:999, background:q.is_available?'#eef7ff':'#fdecea', color:q.is_available?'#1a73e8':'#b00020', fontWeight:800 }}>{q.is_available?'Available':'Unavailable'}</span>
                                {user?.role === 'student' && takenSet.has(Number(q.id)) && !q.is_repeatable && (
                                  <span title="You've already taken this quiz" style={{ fontSize:14, padding:'4px 8px', borderRadius:999, background:'#fdecea', color:'#b00020', fontWeight:800 }}>Taken</span>
                                )}
                              </div>
                              {/* Toggles: Repeatable + Available (styled) — teacher only */}
                              {isTeacherView && (
                                <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14, flexWrap:'wrap' }}>
                                  <label style={{ display:'flex', alignItems:'center', gap:8, margin:0 }}>
                                    <input className="qd-big-pink" type="checkbox" checked={!!q.is_repeatable} onChange={async (e)=>{
                                      const val = e.target.checked;
                                      try { const upd = await qapi.update(q.id, { is_repeatable: val }); setCourseQuizzes(prev => prev.map(x => x.id===q.id? { ...x, is_repeatable: upd.is_repeatable }: x)); } catch(err){ window.dispatchEvent(new CustomEvent('toast',{detail:{type:'error',message:err.message||'Failed'}})); }
                                    }} />
                                    <span>Repeatable</span>
                                  </label>
                                  <div className="qd-lock" style={{ display:'flex', alignItems:'center', gap:8 }}>
                                    <input type="checkbox" id={`cardAvail-${q.id}`} className="lock-input" checked={!!q.is_available} onChange={async ()=>{
                                      try{ const res = await qapi.toggle(q.id); setCourseQuizzes(prev => prev.map(x => x.id===q.id?res:x)); } catch(e){ window.dispatchEvent(new CustomEvent('toast',{detail:{type:'error',message:e.message}})); }
                                    }} />
                                    <label htmlFor={`cardAvail-${q.id}`} className="lock-label">
                                      <span className="lock-wrapper">
                                        <span className="shackle"></span>
                                        <svg className="lock-body" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                                          <path fillRule="evenodd" clipRule="evenodd" d="M0 5C0 2.23858 2.23858 0 5 0H23C25.7614 0 28 2.23858 28 5V23C28 25.7614 25.7614 28 23 28H5C2.23858 28 0 25.7614 0 23V5ZM16 13.2361C16.6137 12.6868 17 11.8885 17 11C17 9.34315 15.6569 8 14 8C12.3431 8 11 9.34315 11 11C11 11.8885 11.3863 12.6868 12 13.2361V18C12 19.1046 12.8954 20 14 20C15.1046 20 16 19.1046 16 18V13.2361Z" fill="white"/>
                                        </svg>
                                      </span>
                                    </label>
                                    <span>Available</span>
                                  </div>
                                </div>
                              )}
                              {/* Actions row: left icons (Publish/Delete), right buttons (View/Manage/Take) */}
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                                  {isTeacherView && (
                                    <>
                                      <Tooltip title={q.is_published ? 'Published' : 'Publish'}>
                                        <span>
                                          <IconButton
                                            className="qd-icon qd-invert"
                                            disabled={!!q.is_published}
                                            onClick={async () => { if (q.is_published) return; try{ await qapi.publish(q.id); setCourseQuizzes(prev => prev.map(x => x.id===q.id?{...x,is_published:true,status:'published'}:x)); window.dispatchEvent(new CustomEvent('toast',{detail:{type:'success',message:'Published'}})); } catch(e){ window.dispatchEvent(new CustomEvent('toast',{detail:{type:'error',message:e.message}})); } }}
                                            sx={{ color:'#6a3ecb', border:'2px solid #6a3ecb', background:q.is_published?'#f5f5f7':'#fff', '&:hover':{ background:'#6a3ecb', color:'#ffffff' } }}
                                          >
                                            <RocketLaunchOutlinedIcon sx={{ color:'currentColor' }} />
                                          </IconButton>
                                        </span>
                                      </Tooltip>
                                      <Tooltip title="Delete quiz">
                                        <span>
                                          <IconButton
                                            className="qd-icon qd-invert"
                                            onClick={() => {
                                              setConfirmDlg({
                                                open:true,
                                                message:'Delete this quiz and all of its items and attempts? This cannot be undone.',
                                                onYes: async () => {
                                                  try{
                                                    await qapi.remove(q.id);
                                                    setCourseQuizzes(prev => prev.filter(x => x.id !== q.id));
                                                    window.dispatchEvent(new CustomEvent('toast',{detail:{type:'success',message:'Quiz deleted'}}));
                                                  } catch(e){
                                                    window.dispatchEvent(new CustomEvent('toast',{detail:{type:'error',message:e.message}}));
                                                  } finally {
                                                    setConfirmDlg({ open:false, message:'', onYes:null });
                                                  }
                                                }
                                              });
                                            }}
                                            sx={{ color:'#d9254f', border:'2px solid #d9254f', background:'#fff', '&:hover':{ background:'#d9254f', color:'#ffffff' } }}
                                          >
                                            <DeleteOutlineIcon sx={{ color:'currentColor' }} />
                                          </IconButton>
                                        </span>
                                      </Tooltip>
                                    </>
                                  )}
                                </div>
                                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                                  {isTeacherView ? (
                                    <>
                                      <button
                                        className="qd-btn-anim"
                                        onClick={() => { setSelectedQuiz(q); setShowQuizDetails(true); }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#e0a20c'; e.currentTarget.style.boxShadow = '0 10px 22px rgba(0,0,0,0.16)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = '#fcb00d'; e.currentTarget.style.boxShadow = '0 8px 18px rgba(0,0,0,0.12)'; }}
                                        style={{ padding:'10px 14px', borderRadius:12, border:'2px solid #000', background:'#fcb00d', color:'#000', fontFamily:'Kodchasan, system-ui', fontWeight:900, boxShadow:'0 8px 18px rgba(0,0,0,0.12)' }}
                                      >View</button>
                                      <button
                                        className="qd-btn-anim"
                                        onClick={() => { setSelectedQuiz(q); setShowQuizDetails(true); navigate(`/manage/quiz/${q.id}`); }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#dd2680'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#dd2680'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#dd2680'; e.currentTarget.style.borderColor = '#dd2680'; }}
                                        style={{ padding:'10px 14px', borderRadius:12, border:'2px solid #dd2680', background:'#fff', color:'#dd2680', fontFamily:'Kodchasan, system-ui', fontWeight:900 }}
                                      >Manage</button>
                                      <button
                                        className="qd-btn-anim"
                                        onClick={() => { setTakeQuizId(q.id); setShowTakeQuiz(true); }}
                                        style={{ padding:'10px 14px', borderRadius:12, border:'2px solid #6a3ecb', background:'#fff', color:'#6a3ecb', fontFamily:'Kodchasan, system-ui', fontWeight:900, transition:'transform .12s ease, background .12s ease, color .12s ease, box-shadow .12s ease, border-color .12s ease' }}
                                        onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.boxShadow='0 10px 20px rgba(106,62,203,.20)'; }}
                                        onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#6a3ecb'; e.currentTarget.style.boxShadow='none'; }}
                                      >Take Quiz</button>
                                    </>
                                  ) : (
                                    <>
                                      <button className="qd-btn-anim" onClick={() => { setSelectedQuiz(q); setShowQuizDetails(true); }} style={{ padding:'10px 14px', borderRadius:12, border:'2px solid #000', background:'#fcb00d', color:'#000', fontFamily:'Kodchasan, system-ui', fontWeight:900 }}>View</button>
                                      <button
                                        className="qd-btn-anim"
                                        onClick={() => { setTakeQuizId(q.id); setShowTakeQuiz(true); }}
                                        style={{ padding:'10px 14px', borderRadius:12, border:'2px solid #6a3ecb', background:'#fff', color:'#6a3ecb', fontFamily:'Kodchasan, system-ui', fontWeight:900, transition:'transform .12s ease, background .12s ease, color .12s ease, box-shadow .12s ease, border-color .12s ease' }}
                                        onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.boxShadow='0 10px 20px rgba(106,62,203,.20)'; }}
                                        onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#6a3ecb'; e.currentTarget.style.boxShadow='none'; }}
                                      >Take Quiz</button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          {courseQuizzes.length === 0 && <div style={{ opacity:.7 }}>No quizzes in this course yet.</div>}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {tab === 'grades' && (
                  <div style={{ padding: 8 }}>
                    {gError && <div style={{ background:'#fdecea', color:'#611a15', padding:10, borderRadius:8, marginBottom:8 }}>{gError}</div>}
                    {gLoading ? (
                      <div>Loading…</div>
                    ) : (
                      <div style={{ display:'grid', gap:10 }}>
                        {(() => {
                          const groups = {};
                          (gradesRows || []).forEach(r => {
                            const key = String(r.quiz_id || r.id || '');
                            if (!groups[key]) groups[key] = { title: r.title, rows: [] };
                            groups[key].rows.push(r);
                          });
                          const entries = Object.entries(groups);
                          if (entries.length === 0) return <div style={{ opacity:.7 }}>No grades for this course yet.</div>;
                          return entries.map(([qid, grp]) => {
                            const open = !!openGrades[qid];
                            const toggle = () => setOpenGrades(o => ({ ...o, [qid]: !open }));
                            return (
                              <div key={qid} style={{ border:'1px solid #eee', borderRadius:10, overflow:'hidden', background:'#fff' }}>
                                <div onClick={toggle} style={{ cursor:'pointer', padding:10, display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f7f3ff', color:'#6a3ecb', fontWeight:900 }}>
                                  <span>{grp.title}</span>
                                  <span style={{ fontSize:14, opacity:.8 }}>{open ? 'Hide' : 'Show'}</span>
                                </div>
                                {open && (
                                  <div style={{ padding:10 }}>
                                    <table style={{ width:'100%', background:'#fff', borderCollapse:'collapse' }}>
                                      <thead>
                                        <tr style={{ textAlign:'left' }}>
                                          {isTeacherView && <th style={{ padding:8 }}>Student</th>}
                                          <th style={{ padding:8 }}>Score</th>
                                          <th style={{ padding:8 }}>Percent</th>
                                          <th style={{ padding:8 }}>Date</th>
                                          {isTeacherView && <th style={{ padding:8 }}>Attempts</th>}
                                          {isTeacherView && <th style={{ padding:8 }}>Actions</th>}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(() => {
                                          const counts = {};
                                          (grp.rows||[]).forEach(rr => {
                                            const key = String(rr.user_id ?? rr.student_id ?? rr.student_username ?? rr.username ?? rr.student_name ?? rr.email ?? '');
                                            counts[key] = (counts[key] || 0) + 1;
                                          });
                                          return grp.rows.map(r => {
                                            const pct = r.total_items ? Math.round((r.score / r.total_items) * 100) : 0;
                                            return (
                                              <tr key={r.attempt_id}>
                                                {isTeacherView && <td style={{ padding:8 }}>{r.student_name || r.student_username || r.username || '—'}</td>}
                                                <td style={{ padding:8 }}>{r.score}/{r.total_items}</td>
                                                <td style={{ padding:8 }}>{pct}%</td>
                                                <td style={{ padding:8 }}>{new Date(r.created_at).toLocaleString()}</td>
                                                {isTeacherView && (
                                                  <td style={{ padding:8 }}>
                                                    {counts[String(r.user_id ?? r.student_id ?? r.student_username ?? r.username ?? r.student_name ?? r.email ?? '')] || 1}
                                                  </td>
                                                )}
                                                {isTeacherView && (
                                                  <td style={{ padding:8 }}>
                                                    <button
                                                      onClick={() => removeAttempt(r.attempt_id)}
                                                      className="qd-btn-anim"
                                                      style={{ padding:'8px 12px', borderRadius:10, border:'2px solid #dd2680', background:'#dd2680', color:'#fff', fontWeight:900, fontFamily:'Kodchasan, system-ui', cursor:'pointer' }}
                                                      onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#dd2680'; }}
                                                      onMouseLeave={e => { e.currentTarget.style.background = '#dd2680'; e.currentTarget.style.color = '#fff'; }}
                                                    >Remove</button>
                                                  </td>
                                                )}
                                              </tr>
                                            );
                                          });
                                        })()}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {tab === 'students' && isTeacherView && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {(students || []).map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #eee', borderRadius: 10, padding: '10px 12px', background: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', background: '#f5f5f5', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {s.profile_image ? (
                              <img src={toImageUrl(s.profile_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontSize: 14, fontWeight: 800, color: '#6a3ecb' }}>{(s.username || s.name || 'U').charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700 }}>{s.username || s.name}</div>
                            <div style={{ fontSize: 14, opacity: 0.7 }}>{s.role}</div>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:8 }}>
                          <button onClick={() => navigate(`/u/${encodeURIComponent(s.username || '')}`)}
                            style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid transparent', background: theme.palette.primary.main, color: '#fff', fontWeight: 800, fontFamily: 'Kodchasan, system-ui', transition: 'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = theme.palette.primary.main; e.currentTarget.style.borderColor = theme.palette.primary.main; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = theme.palette.primary.main; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                          >View</button>
                          <button onClick={() => removeStudent(s.id)} style={{ padding: '8px 12px', borderRadius: 10, border: '2px solid #d32f2f', background: '#fff', color: '#d32f2f', fontWeight: 800, fontFamily:'Kodchasan, system-ui', transition: 'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = '#d32f2f'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#d32f2f'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#d32f2f'; e.currentTarget.style.borderColor = '#d32f2f'; }}>Remove</button>
                        </div>
                      </div>
                    ))}
                    {students.length === 0 && <div style={{ opacity: 0.7 }}>No students yet.</div>}
                  </div>
                )}

                {tab === 'announcements' && (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {isTeacherView && (
                      <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 10 }}>
                        <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title" style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #e6e0f4', background: '#faf7ff', marginBottom: 8, fontFamily: 'Kodchasan, system-ui' }} />
                        <textarea value={newAnnouncement} onChange={e => setNewAnnouncement(e.target.value)} rows={3} placeholder="Write an announcement" style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #e6e0f4', background: '#faf7ff' }} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                          <button disabled={posting} onClick={postAnnouncement} style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid transparent', background: theme.palette.primary.main, color: '#fff', fontWeight: 800, fontFamily: 'Kodchasan, system-ui', boxShadow: '0 8px 18px rgba(108,99,255,0.28)', transition: 'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = theme.palette.primary.main; e.currentTarget.style.borderColor = theme.palette.primary.main; }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = theme.palette.primary.main; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}>{posting ? 'Posting…' : 'Post'}</button>
                        </div>
                      </div>
                    )}
                    {(course.announcements || []).map(a => (
                      <div key={a.id} style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', gap: 12, transition:'transform .14s ease, box-shadow .14s ease' }}
                        onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 10px 22px rgba(106,62,203,0.14)'; }}
                        onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            {chip(new Date(a.created_at).toLocaleString(), '#eef7ff', '#1a73e8')}
                            {chip(course.name || course.course_name || 'Course', '#f7f3ff', '#6a3ecb')}
                          </div>
                          {editAnnId === a.id ? (
                            <div style={{ display: 'grid', gap: 6 }}>
                              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Title" style={{ padding: 8, borderRadius: 8, border: '1px solid #e6e0f4', fontFamily: 'Kodchasan, system-ui' }} />
                              <textarea value={editMessage} onChange={e => setEditMessage(e.target.value)} rows={3} placeholder="Message" style={{ padding: 8, borderRadius: 8, border: '1px solid #e6e0f4', fontFamily: 'Kodchasan, system-ui' }} />
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontWeight: 800, color: '#3e2a6d', marginBottom: 2 }}>{a.title}</div>
                              <div>{a.message}</div>
                            </div>
                          )}
                        </div>
                        {isTeacherView ? (
                          <div style={{ display: 'flex', gap: 8 }}>
                            {editAnnId === a.id ? (
                              <>
                                <button
                                  onClick={() => saveAnnouncement(a.id)}
                                  style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid transparent', background: theme.palette.primary.main, color: '#fff', fontWeight: 800, fontFamily: 'Kodchasan, system-ui', boxShadow: '0 8px 18px rgba(108,99,255,0.22)', transition: 'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
                                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = theme.palette.primary.main; e.currentTarget.style.borderColor = theme.palette.primary.main; }}
                                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = theme.palette.primary.main; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'transparent'; }}
                                >Save</button>
                                <button
                                  onClick={() => { setEditAnnId(null); setEditTitle(''); setEditMessage(''); }}
                                  style={{ padding: '8px 12px', borderRadius: 10, border: '2px solid #e6e0f4', background: '#fff', color: '#6a3ecb', fontWeight: 800, fontFamily: 'Kodchasan, system-ui', transition: 'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
                                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = '#6a3ecb'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#6a3ecb'; }}
                                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#6a3ecb'; e.currentTarget.style.borderColor = '#e6e0f4'; }}
                                >Cancel</button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => { setEditAnnId(a.id); setEditTitle(a.title || ''); setEditMessage(a.message || ''); }}
                                  style={{ padding: '8px 12px', borderRadius: 10, border: '2px solid #e6e0f4', background: '#fff', color: '#6a3ecb', fontWeight: 800, fontFamily: 'Kodchasan, system-ui', transition: 'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
                                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = '#6a3ecb'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#6a3ecb'; }}
                                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#6a3ecb'; e.currentTarget.style.borderColor = '#e6e0f4'; }}
                                >Edit</button>
                                <button
                                  onClick={() => deleteAnnouncement(a.id)}
                                  style={{ padding: '8px 12px', borderRadius: 10, border: '2px solid #d32f2f', background: '#fff', color: '#d32f2f', fontWeight: 800, fontFamily: 'Kodchasan, system-ui', transition: 'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
                                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = '#d32f2f'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#d32f2f'; }}
                                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#d32f2f'; e.currentTarget.style.borderColor = '#d32f2f'; }}
                                >Delete</button>
                              </>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <button
                              onClick={async () => {
                                try { await apiRequest('/api/announcements/dismiss', { method: 'POST', token, body: { ids: [a.id] } }); } catch(_) {}
                                try { window.dispatchEvent(new CustomEvent('dashboard:update')); } catch(_) {}
                                setCourse(prev => ({ ...prev, announcements: (prev.announcements || []).filter(x => x.id !== a.id) }));
                              }}
                              title="Acknowledge"
                              style={{ marginRight: 4, padding: '8px 12px', borderRadius: 10, border: '1px solid #e6e0f4', background: '#fff', color: '#6a3ecb', fontWeight: 800, fontFamily: 'Kodchasan, system-ui', cursor: 'pointer', transition: 'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease', boxShadow:'0 4px 10px rgba(106,62,203,0.10)' }}
                              onMouseEnter={e=>{ e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='#6a3ecb'; e.currentTarget.style.transform='translateY(-1px)'; }}
                              onMouseLeave={e=>{ e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#6a3ecb'; e.currentTarget.style.borderColor='#e6e0f4'; e.currentTarget.style.transform='none'; }}
                            >Acknowledge</button>
                          </div>
                        )}
                      </div>
                    ))}
                    {(course.announcements || []).length === 0 && <div style={{ opacity: 0.7 }}>No announcements yet.</div>}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: 24 }}>Not found.</div>
            )}
          </div>
          <SidebarRight isOpen={isRightOpen} />
          {(isLeftOpen || isRightOpen) && (
            <div style={overlayStyles} onClick={() => { setIsLeftOpen(false); setIsRightOpen(false); }} />
          )}
        </div>
      </div>
    </CustomThemeProvider>
    {showQuizDetails && selectedQuiz && (
      <QuizDetailsModal
        token={token}
        user={user}
        quiz={selectedQuiz}
        open={showQuizDetails}
        onClose={() => { setShowQuizDetails(false); setSelectedQuiz(null); }}
        onUpdated={(upd) => { setCourseQuizzes(prev => prev.map(x => x.id === upd.id ? upd : x)); setSelectedQuiz(upd); }}
        onDeleted={(qid) => { setCourseQuizzes(prev => prev.filter(x => x.id !== qid)); }}
        onPublished={(upd) => { setCourseQuizzes(prev => prev.map(x => x.id === upd.id ? upd : x)); setSelectedQuiz(upd); }}
        onManage={(qid) => { setShowQuizDetails(false); navigate(`/manage/quiz/${qid}`); }}
        onTake={(qid) => { setShowQuizDetails(false); setTakeQuizId(qid); setShowTakeQuiz(true); }}
      />
    )}
    {showTakeQuiz && takeQuizId && (
      <TakeQuizModal token={token} quizId={takeQuizId} onClose={() => { setShowTakeQuiz(false); setTakeQuizId(null); }} />
    )}
    {showCreateQuiz && (
      <CreateQuizModal
        token={token}
        user={user}
        lockedCourseId={Number(courseId)}
        onClose={() => setShowCreateQuiz(false)}
        onCreated={(created) => {
          const cid = created.course_id ?? (created.course?.id);
          if (String(cid || '') === String(courseId)) {
            setCourseQuizzes(prev => [created, ...prev]);
          }
          try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Quiz created' } })); } catch(_) {}
        }}
      />
    )}
    {undoAnnId && (
      <div style={{ position:'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 24, background:'#2b2340', color:'#fff', padding:'10px 14px', borderRadius:12, boxShadow:'0 10px 22px rgba(0,0,0,0.25)', display:'flex', alignItems:'center', gap:10, fontFamily:'Kodchasan, system-ui', opacity: 0.95, zIndex: 70 }}>
        <span>Announcement dismissed</span>
        <button onClick={() => {
          if (!undoAnnId) return;
          if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
          if (lastDismissed) {
            setCourse(prev => ({ ...prev, announcements: [lastDismissed, ...(prev.announcements || [])] }));
          }
          setUndoAnnId(null);
          setLastDismissed(null);
        }}
          style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #6a3ecb', background:'#fff', color:'#6a3ecb', fontWeight:800, cursor:'pointer' }}>Undo</button>
      </div>
    )}
    {/* Legacy confirm removed in favor of shared QuizDeck dialog */}
    {confirmDlg.open && (
      <div className="qd-font" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.28)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:120 }}>
        <div style={{ width:420, maxWidth:'92vw', background:'#fff', borderRadius:16, boxShadow:'0 18px 44px rgba(0,0,0,.22)', overflow:'hidden' }}>
          <div style={{ background:'#dd2680', color:'#fff', fontWeight:900, padding:'10px 14px' }}>QuizDeck</div>
          <div style={{ padding:16, fontSize:16 }}>{confirmDlg.message}</div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:16 }}>
            <button
              className="qd-btn-ghost"
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
            >{/delete/i.test(confirmDlg.message||'') ? 'Delete' : (/leave/i.test(confirmDlg.message||'') ? 'Leave' : 'Confirm')}</button>
          </div>
        </div>
      </div>
    )}
    {editOpen && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
        <div style={{ width: 'min(700px, 96vw)', background: '#fff', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Edit Course</h3>
            <button onClick={() => setEditOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Name</span>
              <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} maxLength={120} style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Description</span>
              <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!editForm.is_public} onChange={e => setEditForm(f => ({ ...f, is_public: e.target.checked }))} />
              <span>Public (join without code)</span>
            </label>
            {!editForm.is_public && (
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Course Code</span>
                <input value={editForm.course_code} onChange={e => setEditForm(f => ({ ...f, course_code: e.target.value }))} maxLength={32} placeholder="e.g. ABC123" style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
              </label>
            )}
            <div>
              <ImageUploader value={editForm.image || course?.image_url || null} onChange={(file) => setEditForm(f => ({ ...f, image: file }))} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setEditOpen(false)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', transition: 'transform .12s ease, background .12s ease' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = '#faf7ff'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = '#fff'; }}>Cancel</button>
              <button type="button" onClick={handleSave} style={{ padding: '10px 14px', borderRadius: 12, border: 'none', background: '#6c63ff', color: '#fff', fontWeight: 800, boxShadow: '0 8px 18px rgba(108,99,255,0.28)', transition: 'transform .12s ease, background .12s ease' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#6a3ecb'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = '#6c63ff'; }}>Save</button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
