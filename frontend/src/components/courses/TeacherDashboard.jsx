import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api';
import CourseCard from './CourseCard';
import CourseCreateForm from './CourseCreateForm';
import CourseDetails from './CourseDetails';
// If CourseCreationModal is not implemented yet, the button can be hidden by parent.

export default function TeacherDashboard({ token }) {
  const [courses, setCourses] = useState([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [activeCourseId, setActiveCourseId] = useState(null);
  const navigate = useNavigate();

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
  const TEACHER_COURSES_KEY = useMemo(() => `qd:cache:teacher:courses:${SESSION_ID}`, [SESSION_ID]);

  async function load() {
    try {
      const list = await apiRequest('/api/courses', { token });
      const arr = Array.isArray(list) ? list : [];
      setCourses(arr);
      try { localStorage.setItem(TEACHER_COURSES_KEY, JSON.stringify(arr)); } catch(_){}
    } catch (_) { setCourses([]); }
  }

  useEffect(() => {
    if (!token) return;
    try { const cached = localStorage.getItem(TEACHER_COURSES_KEY); if (cached) setCourses(JSON.parse(cached) || []); } catch(_){ }
    load();
  }, [token]);

  // No modal: navigate to full management page

  return (
    <div style={{ padding: 16, fontFamily: 'Kodchasan, system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Your Courses</h2>
        <button onClick={() => setOpenCreate(true)} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#ff4d6d', color: '#fff', fontWeight: 700 }}>Create New Course</button>
      </div>
      {courses.length === 0 && <div style={{ opacity: 0.7 }}>No courses yet.</div>}
      <div className="qd-grid">
        {courses.map(c => (
          <CourseCard key={c.id} course={c} onClick={() => navigate(`/course/${c.id}`)} />
        ))}
      </div>
      {openCreate && (
        <CourseCreateForm token={token} onClose={() => setOpenCreate(false)} onCreated={() => load()} />
      )}
      {false && activeCourseId && (<CourseDetails token={token} courseId={activeCourseId} isTeacherView onClose={() => setActiveCourseId(null)} />)}
    </div>
  );
}
