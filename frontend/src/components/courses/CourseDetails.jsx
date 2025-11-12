import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest, toImageUrl } from '../../api';

export default function CourseDetails({ token, courseId, onClose, isTeacherView }) {
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('info'); // 'info' | 'students' | 'announcements'
  const [error, setError] = useState('');
  const [students, setStudents] = useState([]);
  const [posting, setPosting] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/courses/${courseId}`, { token });
      setCourse(data || null);
      if (isTeacherView) {
        try { const list = await apiRequest(`/api/courses/${courseId}/students`, { token }); setStudents(Array.isArray(list) ? list : []); } catch (_) {}
      }
    } catch (e) {
      setError(e.message || 'Failed to load course');
    } finally { setLoading(false); }
  }

  useEffect(() => { if (token && courseId) load(); }, [token, courseId]);

  async function removeStudent(uid) {
    if (!window.confirm('Remove this student from the course?')) return;
    try {
      await apiRequest(`/api/courses/${courseId}/students/${uid}`, { method: 'DELETE', token });
      setStudents(prev => prev.filter(s => s.id !== uid));
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Removed from course' } }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to remove' } }));
    }
  }

  async function postAnnouncement() {
    if (!newAnnouncement.trim()) return;
    setPosting(true);
    try {
      await apiRequest(`/api/courses/${courseId}/announcements`, { method: 'POST', token, body: { content: newAnnouncement.trim() } });
      setNewAnnouncement('');
      await load();
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Announcement posted' } }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to post' } }));
    } finally { setPosting(false); }
  }

  async function deleteAnnouncement(id) {
    if (!window.confirm('Delete this announcement?')) return;
    try { await apiRequest(`/api/announcements/${id}`, { method: 'DELETE', token }); await load(); } catch (e) {}
  }

  if (!courseId) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }}>
      <div style={{ width: 'min(820px, 96vw)', background: '#fff', borderRadius: 12, padding: 14, maxHeight: '92vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Course Details</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        {error && <div style={{ background: '#fdecea', color: '#611a15', padding: 8, borderRadius: 8, marginTop: 8 }}>{error}</div>}
        {loading ? (
          <div style={{ padding: 24 }}>Loading…</div>
        ) : course ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 220, height: 140, background: '#f5f5f5', borderRadius: 8, overflow: 'hidden' }}>
                {course.image_url ? (<img alt="" src={toImageUrl(course.image_url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No image</div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{course.name || course.course_name}</div>
                <div style={{ opacity: 0.8, marginTop: 4 }}>{course.description || ''}</div>
                <div style={{ marginTop: 6, fontSize: 13 }}>Teacher: {course.teacher?.username || ''}</div>
                <div style={{ fontSize: 13 }}>Students: {course.students_count ?? 0}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => setTab('info')} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', background: tab==='info'?'#f7f3ff':'#fff' }}>Info</button>
              {isTeacherView && <button onClick={() => setTab('students')} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', background: tab==='students'?'#f7f3ff':'#fff' }}>Manage Students</button>}
              <button onClick={() => setTab('announcements')} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', background: tab==='announcements'?'#f7f3ff':'#fff' }}>Announcements</button>
            </div>

            {tab === 'info' && (
              <div style={{ padding: 8 }}>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Quizzes: Coming soon</div>
              </div>
            )}

            {tab === 'students' && isTeacherView && (
              <div style={{ display: 'grid', gap: 8 }}>
                {(students || []).map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #eee', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#f5f5f5', border: '1px solid #eee' }} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{s.username || s.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{s.role}</div>
                      </div>
                    </div>
                    <button onClick={() => removeStudent(s.id)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#e53935', color: '#fff', fontWeight: 700 }}>Remove</button>
                  </div>
                ))}
                {students.length === 0 && <div style={{ opacity: 0.7 }}>No students yet.</div>}
              </div>
            )}

            {tab === 'announcements' && (
              <div style={{ display: 'grid', gap: 10 }}>
                {isTeacherView && (
                  <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 10 }}>
                    <textarea value={newAnnouncement} onChange={e => setNewAnnouncement(e.target.value)} rows={3} placeholder="Write an announcement" style={{ width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid #ddd' }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                      <button disabled={posting} onClick={postAnnouncement} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#6c63ff', color: '#fff', fontWeight: 700 }}>{posting ? 'Posting…' : 'Post'}</button>
                    </div>
                  </div>
                )}
                {(course.announcements || []).map(a => (
                  <div key={a.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{new Date(a.created_at).toLocaleString()}</div>
                      <div>{a.content}</div>
                    </div>
                    {isTeacherView && <button onClick={() => deleteAnnouncement(a.id)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#e53935', color: '#fff', fontWeight: 700 }}>Delete</button>}
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
    </div>
  );
}
