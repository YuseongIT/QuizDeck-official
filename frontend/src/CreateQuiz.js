import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiRequest } from './api';
import Header from './Header';
import { CustomThemeProvider, mainContentStyles, theme } from './theme';
import { Box, Typography, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';

export default function CreateQuiz() {
  const { token, user } = useAuth();
  const isTeacher = useMemo(() => user?.role === 'teacher', [user]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', course_id: '', visibility: 'public' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const crs = await apiRequest('/api/courses', { token });
        if (mounted) setCourses(crs || []);
      } catch (e) {
        if (mounted) setError(e.message || 'Failed to load courses');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [token]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.course_id) return;
    setSubmitting(true);
    setError('');
    try {
      await apiRequest('/api/quizzes', { method: 'POST', token, body: form });
      navigate('/quizzes');
    } catch (e) {
      setError(e.message || 'Failed to create quiz');
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
            <h2 style={{ margin: 0, color: '#6a3ecb', marginBottom: 16 }}>Create Quiz</h2>

            {error && <div style={{ background: '#fdecea', color: '#611a15', padding: 12, borderRadius: 8, marginBottom: 12 }}>{error}</div>}

            {loading ? (
              <div className="loader-container">
                <div className="loader" />
                <div className="loader-text">Loading...</div>
              </div>
            ) : (
              <form onSubmit={onSubmit} style={{ background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title" style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
                  <select value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })} style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }}>
                    <option value="">Select course</option>
                    {courses.map(c => (<option key={c.id} value={c.id}>{c.course_name}</option>))}
                  </select>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={3} style={{ gridColumn: '1 / span 2', padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
                  <select value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })} style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }}>
                    <option value="public">Public</option>
                    <option value="friends">Friends</option>
                  </select>
                  <button disabled={submitting} type="submit" style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: theme.palette.primary.main, color: '#fff', fontWeight: 700 }}>
                    {submitting ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </CustomThemeProvider>
  );
}
