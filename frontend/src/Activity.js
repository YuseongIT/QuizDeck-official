import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from './api';
import Header from './Header';
import SidebarLeft from './SidebarLeft';
import SidebarRight from './SidebarRight';
import { CustomThemeProvider, mainContentStyles, theme, overlayStyles } from './theme';
import { Box, Typography, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function Activity() {
  const { token, user } = useAuth();
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isTeacher = useMemo(() => user?.role === 'teacher', [user]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const data = await apiRequest('/api/activity', { token });
        if (mounted) setItems(data || []);
      } catch (e) {
        if (mounted) setError(e.message || 'Failed to load activity');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [token]);

  const containerStyle = { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#d5ceed' };

  return (
    <CustomThemeProvider>
      <div style={containerStyle}>
        <Header 
          isDashboard={true}
          isLeftOpen={isLeftOpen}
          isRightOpen={isRightOpen}
          toggleLeft={() => setIsLeftOpen(prev => !prev)}
          toggleRight={() => setIsRightOpen(prev => !prev)}
        />
        <div style={{ position: 'relative', flexGrow: 1 }}>
          <SidebarLeft isOpen={isLeftOpen} />
          <div style={mainContentStyles.base}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <IconButton aria-label="Back" onClick={() => navigate(-1)} sx={{ color: theme.palette.secondary.main }}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.secondary.main }}>Back</Typography>
            </Box>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, color: '#6a3ecb' }}>Recent Activity</h2>
              <span style={{ padding: '6px 12px', background: theme.palette.action.main, color: '#fff', borderRadius: 999, fontWeight: 700 }}>{user?.role}</span>
            </div>

            {error && <div style={{ background: '#fdecea', color: '#611a15', padding: 12, borderRadius: 8, marginBottom: 12 }}>{error}</div>}

            {loading ? (
              <div>Loading...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {items.map(a => (
                  <div key={a.id} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <div style={{ fontWeight: 800, color: '#6a3ecb', marginBottom: 6 }}>{a.quiz?.title || 'Quiz'}</div>
                    <div style={{ opacity: 0.8 }}>{a.quiz?.course?.course_name || ''}</div>
                    <div style={{ marginTop: 8 }}>
                      {isTeacher && a.user && (
                        <span style={{ fontSize: 12, opacity: 0.8 }}>By {a.user.username}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                      <span>Score: {a.score ?? '—'}</span>
                      <span>{a.completed_at ? new Date(a.completed_at).toLocaleString() : ''}</span>
                    </div>
                  </div>
                ))}
                {items.length === 0 && <div style={{ opacity: 0.7 }}>No activity yet.</div>}
              </div>
            )}
          </div>
          <SidebarRight isOpen={isRightOpen} />
          {(isLeftOpen || isRightOpen) && (
            <div style={overlayStyles} onClick={() => { setIsLeftOpen(false); setIsRightOpen(false); }} />
          )}
        </div>
      </div>
    </CustomThemeProvider>
  );
}
