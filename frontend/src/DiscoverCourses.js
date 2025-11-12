import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiRequest } from './api';
import Header from './Header';
import UserProfileModal from './UserProfileModal';
import { CustomThemeProvider, mainContentStyles, theme } from './theme';
import { Box, Typography, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import CourseCard from './components/courses/CourseCard';

export default function DiscoverCourses() {
  const { token } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enrolling, setEnrolling] = useState(null);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const qs = debounced ? `?q=${encodeURIComponent(debounced)}` : '';
        const data = await apiRequest(`/api/courses/public${qs}`, { token });
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        if (mounted) setCourses(list);
      } catch (e) {
        if (mounted) setError(e.message || 'Failed to load courses');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [token, debounced]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function enroll(course) {
    setEnrolling(course.id);
    setError('');
    try {
      await apiRequest('/api/enrollments', { method: 'POST', token, body: { course_id: course.id } });
      // Optionally mark enrolled
      setCourses(prev => {
        const arr = Array.isArray(prev) ? prev : (Array.isArray(prev?.data) ? prev.data : []);
        return arr.map(c => c.id === course.id ? { ...c, _enrolled: true } : c);
      });
    } catch (e) {
      setError(e.message || 'Failed to enroll');
    } finally {
      setEnrolling(null);
    }
  }

  // Normalize to array in case API returns an object shape
  const filtered = useMemo(() => {
    if (Array.isArray(courses)) return courses;
    if (courses && Array.isArray(courses.data)) return courses.data;
    return [];
  }, [courses]);
  const courseCards = useMemo(() => (
    filtered.map(c => (
      <CourseCard
        key={c.id}
        course={c}
        onClick={() => navigate(`/course/${c.id}`)}
        showEnroll={true}
        enrolled={!!c._enrolled}
        enrolling={enrolling === c.id}
        onEnroll={async (course) => {
          await enroll(course);
          try { window.dispatchEvent(new CustomEvent('courses:update')); window.dispatchEvent(new CustomEvent('dashboard:update')); } catch(_) {}
        }}
      />
    ))
  ), [filtered, enrolling, navigate]);
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, color: '#6a3ecb' }}>Discover Courses</h2>
              <div className="search-rounded">
                <SearchIcon sx={{ color: '#6a3ecb' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses" />
              </div>
            </div>

            {error && <div style={{ background: '#fdecea', color: '#611a15', padding: 12, borderRadius: 8, marginBottom: 12 }}>{error}</div>}

            {loading ? (
              <div className="loader-container">
                <div className="loader" />
                <div className="loader-text">Loading...</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                {courseCards}
                {filtered.length === 0 && <div style={{ opacity: 0.7 }}>No courses found.</div>}
              </div>
            )}
          </div>
        </div>
        {profileUser && (
          <UserProfileModal username={profileUser} token={token} onClose={() => setProfileUser('')} />
        )}
      </div>
    </CustomThemeProvider>
  );
}
