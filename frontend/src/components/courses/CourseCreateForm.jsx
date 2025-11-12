import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../../api';
import ImageUploader from './ImageUploader';
import { theme } from '../../theme';

export default function CourseCreateForm({ token, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [image, setImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    if (!isPublic && !courseCode.trim()) { setError('Course code is required for private courses'); return; }
    setSubmitting(true);
    setError('');
    try {
      const base = API_BASE;
      const formData = new FormData();
      formData.append('name', name.trim());
      if (description) formData.append('description', description);
      // append both styles to satisfy any backend naming
      formData.append('is_public', isPublic ? '1' : '0');
      formData.append('isPublic', isPublic ? 1 : 0);
      if (!isPublic) formData.append('course_code', courseCode.trim());
      // diagnostics for file binding
      // eslint-disable-next-line no-console
      console.log('[DIAG] image instanceof File:', image instanceof File);
      // eslint-disable-next-line no-console
      console.log('[DIAG] image:', image);
      if (image instanceof File) {
        // eslint-disable-next-line no-console
        formData.append('image', image, image.name);
      } else if (image) {
        // eslint-disable-next-line no-console
        console.debug('[DIAG] image instanceof File:', false);
      }
      // eslint-disable-next-line no-console
      console.log('[DEBUG] POST /api/courses', { name, isPublic, hasImage: image instanceof File });
      const res = await axios.post(`${base}/api/courses`, formData, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      // eslint-disable-next-line no-console
      console.log('[DEBUG] create course status:', res.status, 'payload:', res.data);
      const created = (res?.data && res.data.course) ? res.data.course : res?.data;
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Course created' } }));
      onCreated?.(created);
      onClose?.();
    } catch (e) {
      const msg = (e?.response?.data?.message) || (e?.response?.data?.error) || e?.message || 'Failed to create course';
      // eslint-disable-next-line no-console
      console.error('[CreateCourse modal] error:', e?.response?.status, e?.response?.data || e);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }}>
      <div style={{ width: 'min(640px, 95vw)', background: '#fff', borderRadius: 12, padding: 0, boxShadow: '0 16px 42px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: theme.palette.primary.main, color: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
          <h3 style={{ margin: 0, fontWeight: 900 }}>Create Course</h3>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>
        <div style={{ padding: 16 }}>
        {error && <div style={{ background: '#fdecea', color: '#611a15', padding: 8, borderRadius: 8, marginBottom: 8 }}>{error}</div>}
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Name</span>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={120} placeholder="Course name" style={{ padding: 12, borderRadius: 10, border: '1px solid #e5e2f2', outline: 'none' }} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Description</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={500} rows={3} placeholder="Description (optional)" style={{ padding: 12, borderRadius: 10, border: '1px solid #e5e2f2' }} />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
              <span>Public (join without code)</span>
            </label>
          </div>
          {!isPublic && (
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Course Code</span>
              <input value={courseCode} onChange={e => setCourseCode(e.target.value)} maxLength={32} placeholder="e.g. ABC123" style={{ padding: 12, borderRadius: 10, border: '1px solid #e5e2f2' }} />
            </label>
          )}
          <div>
            <ImageUploader value={image} onChange={setImage} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e2f2', background: '#fff' }}>Cancel</button>
            <button disabled={submitting} type="submit" style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: theme.palette.primary.main, color: '#fff', fontWeight: 800, boxShadow: '0 6px 14px rgba(108,99,255,0.3)' }}>{submitting ? 'Creating…' : 'Create'}</button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
