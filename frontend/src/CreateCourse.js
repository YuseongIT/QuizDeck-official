import React, { useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiRequest, API_BASE } from './api';
import Header from './Header';
import { CustomThemeProvider, mainContentStyles, theme } from './theme';
import { Box, Typography, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import ImageUploader from './components/courses/ImageUploader';

export default function CreateCourse() {
  const { token, user } = useAuth();
  const isTeacher = useMemo(() => user?.role === 'teacher', [user]);
  const [form, setForm] = useState({ course_name: '', course_code: '', description: '', is_public: true, image: null });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    if (!isTeacher) { setError('Teachers only'); return; }
    if (!form.course_name) { setError('Course name is required'); return; }
    if (!form.is_public && !form.course_code) { setError('Course code is required for private courses'); return; }
    setSubmitting(true);
    setError('');
    try {
      const base = API_BASE;
      const fd = new FormData();
      fd.append('name', form.course_name);
      if (form.description) fd.append('description', form.description);
      fd.append('is_public', form.is_public ? '1' : '0');
      if (!form.is_public) fd.append('course_code', form.course_code);
      // diagnostics
      // eslint-disable-next-line no-console
      console.log('[DIAG] image instanceof File:', form.image instanceof File, form.image?.name);
      if (form.image instanceof File) {
        fd.append('image', form.image);
      }
      // eslint-disable-next-line no-console
      console.log('[DEBUG] POST /api/courses', { hasImage: form.image instanceof File, name: form.course_name, is_public: form.is_public });
      const res = await fetch(`${base}/api/courses`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      let json = null; try { json = await res.json(); } catch(_) {}
      // eslint-disable-next-line no-console
      console.log('[DEBUG] create response', res.status, json);
      if (!res.ok) throw new Error((json && json.message) || 'Failed to create course');
      navigate('/courses');
    } catch (e) {
      setError(e.message || 'Failed to create course');
    } finally {
      setSubmitting(false);
    }
  }

  const containerStyle = { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#d5ceed' };

  return (
    <CustomThemeProvider>
      <div style={containerStyle}>
        <Header isDashboard={false} />
        <div style={{ position: 'relative', flexGrow: 1 }}>
          <div style={mainContentStyles.base}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <IconButton aria-label="Back" onClick={() => navigate(-1)} sx={{ color: theme.palette.secondary.main }}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.secondary.main }}>Back</Typography>
            </Box>
            <h2 style={{ margin: 0, color: '#6a3ecb', marginBottom: 16 }}>Create Course</h2>

            {error && <div style={{ background: '#fdecea', color: '#611a15', padding: 12, borderRadius: 8, marginBottom: 12 }}>{error}</div>}

            <form onSubmit={onSubmit} style={{ background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: 16 }}>
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input value={form.course_name} onChange={e => setForm({ ...form, course_name: e.target.value })} placeholder="Course Name" style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
                  {!form.is_public && (
                    <input value={form.course_code} onChange={e => setForm({ ...form, course_code: e.target.value })} placeholder="Course Code" style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
                  )}
                </div>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Description (optional)" style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_public} onChange={e => setForm({ ...form, is_public: e.target.checked })} />
                  <span>Public (join without code)</span>
                </label>
                <ImageUploader value={form.image} onChange={(file) => setForm({ ...form, image: file })} />
                <button disabled={submitting} type="submit" style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: theme.palette.primary.main, color: '#fff', fontWeight: 700 }}>
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </CustomThemeProvider>
  );
}
