import React from 'react';
import { toImageUrl } from '../../api';
import { theme } from '../../theme';

function CourseCard({ course, onClick }) {
  const srcRaw = course?.image_url || course?.course_image_url || null;
  const imgUrl = srcRaw ? toImageUrl(srcRaw) : null;
  const resolvedSrc = imgUrl || null;
  const isPublic = !!course?.is_public;
  const students = course?.students_count ?? course?.enrolled_count ?? 0;
  const quizzes = course?.quizzes_count ?? 0;
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 16,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 8px 18px rgba(0,0,0,0.06)',
        transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 16px 28px rgba(106,62,203,0.18)'; e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)'; e.currentTarget.style.borderColor = '#e6dbff'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 8px 18px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'; }}
    >
      <div style={{ position: 'relative', height: 140, background: '#f5f5f5' }}>
        {resolvedSrc ? (
          <img loading="lazy" decoding="async" src={resolvedSrc} alt="course" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.palette.primary.main, background: '#faf7ff' }}>No image</div>
        )}
        <span style={{ position: 'absolute', top: 8, left: 8, background: isPublic ? '#e6f7ef' : '#fff4e6', color: isPublic ? '#0f9d58' : '#b26a00', fontWeight: 800, fontSize: 12, padding: '4px 8px', borderRadius: 999, border: '1px solid rgba(0,0,0,0.06)' }}>{isPublic ? 'Public' : 'Private'}</span>
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ fontWeight: 800, fontFamily: 'Kodchasan, system-ui', color: '#3e2a6d' }}>{course?.name || course?.course_name}</div>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>{course?.description || ''}</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 12 }}>
          <div style={{ background: '#f7f3ff', color: '#6a3ecb', padding: '4px 8px', borderRadius: 8, fontWeight: 700 }}>Students: {students}</div>
          <div style={{ background: '#fff6e6', color: '#b26a00', padding: '4px 8px', borderRadius: 8, fontWeight: 700 }}>Quizzes: {quizzes}</div>
        </div>
        {course?.teacher && (
          <div style={{ marginTop: 8 }}>
            <span style={{ background: '#eef7ff', color: '#1a73e8', padding: '4px 8px', borderRadius: 999, fontWeight: 800, fontSize: 12, border: '1px solid rgba(0,0,0,0.06)' }}>
              Teacher: {course.teacher.username || course.teacher.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(CourseCard);
