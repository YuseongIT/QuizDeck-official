import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../api';
import CourseCard from './CourseCard';

export default function StudentDashboard({ token }) {
  const [myCourses, setMyCourses] = useState([]);
  const [discover, setDiscover] = useState([]);
  const [q, setQ] = useState('');

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
  const MINE_KEY = useMemo(() => `qd:cache:student:myCourses:${SESSION_ID}`, [SESSION_ID]);
  const DISCOVER_KEY = useMemo(() => `qd:cache:courses:discover:${SESSION_ID}:${(q||'').trim().toLowerCase()}`, [SESSION_ID, q]);

  async function loadMine() {
    try { const list = await apiRequest('/api/me/courses', { token }); setMyCourses(Array.isArray(list) ? list : []); try { localStorage.setItem(MINE_KEY, JSON.stringify(Array.isArray(list)?list:[])); } catch(_){} } catch (_) { setMyCourses([]); }
  }
  async function loadDiscover() {
    try { const list = await apiRequest(`/api/courses/public${q ? `?q=${encodeURIComponent(q)}` : ''}`, { token }); setDiscover(Array.isArray(list) ? list : []); try { localStorage.setItem(DISCOVER_KEY, JSON.stringify(Array.isArray(list)?list:[])); } catch(_){} } catch (_) { setDiscover([]); }
  }

  useEffect(() => {
    if (!token) return;
    try { const cached = localStorage.getItem(MINE_KEY); if (cached) setMyCourses(JSON.parse(cached) || []); } catch(_){ }
    try { const cachedD = localStorage.getItem(DISCOVER_KEY); if (cachedD) setDiscover(JSON.parse(cachedD) || []); } catch(_){ }
    loadMine(); loadDiscover();
  }, [token]);
  useEffect(() => { const id = setTimeout(loadDiscover, 300); return () => clearTimeout(id); }, [q]);

  async function joinByCode() {
    const code = window.prompt('Enter course code:');
    if (!code) return;
    try {
      await apiRequest(`/api/courses/${encodeURIComponent(code)}/join`, { method: 'POST', token });
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Joined course' } }));
      await Promise.all([loadMine(), loadDiscover()]);
    } catch (e) {
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to join' } }));
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: 'Kodchasan, system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Your Enrolled Courses</h2>
        <button onClick={joinByCode} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#6c63ff', color: '#fff', fontWeight: 700 }}>Join via Code</button>
      </div>
      {myCourses.length === 0 && <div style={{ opacity: 0.7 }}>No enrolled courses yet.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>
        {myCourses.map(c => (
          <CourseCard key={c.id} course={c} onClick={() => {}} />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0 }}>Discover Courses</h3>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd', minWidth: 200 }} />
      </div>
      {discover.length === 0 && <div style={{ opacity: 0.7 }}>No public courses yet.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {discover.map(c => (
          <CourseCard key={c.id} course={c} onClick={() => {}} />
        ))}
      </div>
    </div>
  );
}
