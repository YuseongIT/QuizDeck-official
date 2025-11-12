import React, { useEffect, useMemo, useState } from 'react';
import { quizzesApi } from '../../hooks/quizzes';
import { apiRequest } from '../../api';

export default function CreateQuizModal({ token, user, onClose, onCreated, lockedCourseId = null }) {
  const api = useMemo(() => quizzesApi(token), [token]);
  const isTeacher = user?.role === 'teacher';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState(lockedCourseId ? String(lockedCourseId) : '');
  // destination: 'private' | 'shared' | '<courseId>' (string id)
  const [dest, setDest] = useState('private');
  const [isRepeatable, setIsRepeatable] = useState(true);
  // Availability is always true on create; can be toggled later from details/manage
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [courses, setCourses] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Session-aware cache key matching QuizzesPage
  function getSessionId() {
    try { const url = new URL(window.location.href); const s = url.searchParams.get('session'); if (s && s.trim()) return s.trim(); } catch(_) {}
    try { const KEY='qd_session_id'; let sid = sessionStorage.getItem(KEY); if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem(KEY, sid); } return sid; } catch(_) { return 'default'; }
  }
  const SESSION_ID = useMemo(() => getSessionId(), []);
  const QUIZ_CACHE_KEY = useMemo(() => `qd:cache:quizzes:list:${SESSION_ID}`, [SESSION_ID]);

  useEffect(() => {
    let mounted = true;
    async function loadCourses() {
      try {
        if (isTeacher && !lockedCourseId) {
          const data = await apiRequest('/api/courses', { token });
          if (mounted) setCourses(Array.isArray(data) ? data : []);
        }
      } catch (_) {}
    }
    loadCourses();
    return () => { mounted = false; };
  }, [isTeacher, token, lockedCourseId]);

  async function submit() {
    if (!title.trim()) return;
    // When not locked to a course, teachers and students can pick destination; require a choice
    if (isTeacher && !lockedCourseId) {
      if (!dest || dest === '') return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        visibility: 'public',
        is_repeatable: !!isRepeatable,
        is_available: true,
      };
      if (lockedCourseId) {
        payload.course_id = Number(lockedCourseId);
      } else {
        // derive from destination
        if (dest === 'private') {
          payload.is_shared = false;
        } else if (dest === 'shared') {
          payload.is_shared = true;
        } else if (/^\d+$/.test(dest)) {
          payload.course_id = Number(dest);
        } else if (isTeacher && courseId) {
          // backward compat if any, prefer explicit courseId
          payload.course_id = Number(courseId);
        } else {
          payload.is_shared = false;
        }
      }
      const created = await api.create(payload);
      // Optional preview upload
      if (imageFile && created && created.id) {
        try {
          const res = await api.uploadPreview(created.id, imageFile);
          if (res && res.preview_image_url) created.preview_image_url = res.preview_image_url;
          try { window.dispatchEvent(new CustomEvent('quiz:preview:updated', { detail: { quizId: created.id, url: created.preview_image_url } })); } catch(_) {}
        } catch (e) {
          try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Image upload failed' } })); } catch(_) {}
        }
      }
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Quiz created' } })); } catch(_) {}
      // Refresh quizzes list cache so pages update instantly
      try {
        const list = await api.list();
        try { localStorage.setItem(QUIZ_CACHE_KEY, JSON.stringify(Array.isArray(list)?list:[])); } catch(_){}
      } catch(_) {}
      if (onCreated) onCreated(created);
      onClose();
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to create' } })); } catch(_) {}
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.25)', backdropFilter:'blur(2px)', animation:'fadeIn .18s ease-out', zIndex: 50 }}>
      <style>{`@keyframes popIn {0%{transform:scale(.96);opacity:.0} 70%{transform:scale(1.02);opacity:.98} 100%{transform:scale(1);opacity:1}} @keyframes fadeIn {from{opacity:0} to{opacity:1}}
      .qd-font { font-family: 'Kodchasan', system-ui, sans-serif; }
      .qd-btn { --bg:#6a3ecb; --fg:#ffffff; font-family:'Kodchasan', system-ui, sans-serif; padding: 10px 14px; border-radius: 12px; border:1px solid transparent; background: var(--bg); color: var(--fg); font-weight: 900; box-shadow: 0 4px 12px rgba(106,62,203,.16); transition: background .15s ease, color .15s ease, transform .12s ease, box-shadow .15s ease; cursor:pointer }
      .qd-btn:hover { background: var(--fg); color: var(--bg); border-color: var(--bg); box-shadow: 0 8px 18px rgba(106,62,203,.22); }
      .qd-btn:active { transform: translateY(1px); }
      .qd-btn-ghost { --bg:#6a3ecb; --fg:#6a3ecb; font-family:'Kodchasan', system-ui, sans-serif; padding: 10px 14px; border-radius:12px; border:2px solid var(--bg); background:#fff; color:var(--fg); font-weight:900; transition: background .15s ease, color .15s ease, transform .12s ease, box-shadow .15s ease; cursor:pointer }
      .qd-btn-ghost:hover { background: var(--bg); color:#fff; box-shadow: 0 6px 14px rgba(106,62,203,.18); }
      .qd-btn-ghost:active { transform: translateY(1px); }
      `}</style>
      <div className="qd-font" style={{ background:'#fff', width: 520, maxWidth:'95vw', borderRadius: 16, padding: 16, boxShadow:'0 14px 36px rgba(0,0,0,0.2)', animation:'popIn .18s ease-out' }}>
        <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 12 }}>Create Quiz</div>
        <div style={{ display:'grid', gap:12 }}>
          <input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" style={{ padding: 12, borderRadius: 10, border:'1px solid #e6e0f4', fontFamily:'Kodchasan, system-ui', fontSize:14 }} />
          <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder="Description" style={{ padding: 12, borderRadius: 10, border:'1px solid #e6e0f4', fontFamily:'Kodchasan, system-ui', fontSize:14 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>Preview image (optional)</div>
            {imagePreview && (
              <div style={{ marginBottom: 8 }}>
                <img
                  alt="preview"
                  src={imagePreview}
                  style={{ width: '100%', height: 240, objectFit: 'contain', background:'#faf7ff', borderRadius: 10, border: '1px solid #eee' }}
                />
              </div>
            )}
            <input type="file" accept="image/*" onChange={(e)=>{
              const f = e.target.files && e.target.files[0];
              setImageFile(f || null);
              if (f) {
                const url = URL.createObjectURL(f);
                setImagePreview(url);
              } else {
                setImagePreview('');
              }
            }} />
          </div>
          {isTeacher && lockedCourseId && null}
          {!lockedCourseId && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>Destination</div>
              <select value={dest} onChange={e=>setDest(e.target.value)} style={{ padding:12, borderRadius:10, border:'1px solid #e6e0f4', fontFamily:'Kodchasan, system-ui', fontSize:14 }}>
                <option value="private">Private</option>
                <option value="shared">Shared</option>
                {isTeacher && courses.length>0 && (
                  <optgroup label="Courses">
                    {courses.map(c => (<option key={c.id} value={String(c.id)}>{c.course_name || c.name}</option>))}
                  </optgroup>
                )}
              </select>
            </div>
          )}
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontFamily:'Kodchasan, system-ui', fontSize:14 }}>
              <input type="checkbox" checked={isRepeatable} onChange={e=>setIsRepeatable(e.target.checked)} /> Repeatable
            </label>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
            <button onClick={onClose} style={{ padding:'10px 14px', borderRadius:12, border:'2px solid #6a3ecb', background:'#fff', color:'#6a3ecb', fontWeight:900, fontFamily:'Kodchasan, system-ui', cursor:'pointer', boxShadow:'0 4px 12px rgba(0,0,0,.08)', transition:'transform .12s ease, box-shadow .15s ease' }} onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 8px 18px rgba(106,62,203,.22)'; }} onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,.08)'; }}>Cancel</button>
            <button disabled={submitting} className="qd-btn" onClick={submit}>{submitting?'Creating…':'Create'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
