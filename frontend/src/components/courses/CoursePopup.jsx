import React, { useEffect, useState } from 'react';
import { apiRequest, toImageUrl } from '../../api';

export default function CoursePopup({ token, courseId, onClose, role = 'student', onChanged }) {
  const [course, setCourse] = useState(null);
  useEffect(() => {
    async function load() {
      try { const c = await apiRequest(`/api/courses/${courseId}`, { token }); setCourse(c); } catch (_) {}
    }
    if (token && courseId) load();
  }, [token, courseId]);

  if (!course) return null;
  const img = course?.image_url ? toImageUrl(course.image_url) : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: 560, maxWidth: '92%', background: '#fff', borderRadius: 12, overflow: 'hidden', fontFamily: 'Kodchasan, system-ui' }}>
        <div style={{ height: 220, background: '#f5f5f5' }}>{img ? <img alt="" src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}</div>
        <div style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>{course.name}</h3>
          <div style={{ opacity: 0.8 }}>{course.description || 'No description'}</div>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <b>Teacher:</b> {course.teacher?.name || course.teacher?.username}
          </div>
          <div style={{ fontSize: 13 }}>
            <b>Students:</b> {course.students_count ?? 0} | <b>Course ID:</b> {course.course_id}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button onClick={onClose} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}>Close</button>
            {role === 'student' ? (
              <LeaveButton token={token} course={course} onChanged={onChanged} />
            ) : (
              <ManageButtons token={token} course={course} onChanged={onChanged} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaveButton({ token, course, onChanged }) {
  async function leave() {
    if (!window.confirm('Leave this course?')) return;
    try { await apiRequest(`/api/courses/${course.id}/leave`, { method: 'POST', token }); onChanged?.(); } catch(_){}
  }
  return <button onClick={leave} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#e53935', color: '#fff', fontWeight: 700 }}>Leave Course</button>;
}

function ManageButtons({ token, course, onChanged }) {
  function openPanel() { window.dispatchEvent(new CustomEvent('course:manage', { detail: { course } })); }
  return (
    <>
      <button onClick={openPanel} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#6c63ff', color: '#fff', fontWeight: 700 }}>Manage</button>
    </>
  );
}
