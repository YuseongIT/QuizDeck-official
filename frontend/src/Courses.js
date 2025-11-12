import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from './api';
import Header from './Header';
import CourseCreateForm from './components/courses/CourseCreateForm';
import SidebarLeft from './SidebarLeft';
import SidebarRight from './SidebarRight';
import { CustomThemeProvider, mainContentStyles, overlayStyles, theme } from './theme';
import { Box, Typography, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CourseCard from './components/courses/CourseCard';

export default function Courses() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isTeacher = useMemo(() => user?.role === 'teacher', [user]);

  const [form, setForm] = useState({ course_name: '', course_code: '' });
  const [joinCode, setJoinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const prettyRole = (r) => r ? r.charAt(0).toUpperCase() + r.slice(1) : '';
  const [q, setQ] = useState('');
  const [openCreate, setOpenCreate] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const endpoint = (user?.role === 'teacher') ? '/api/courses' : '/api/me/courses';
        const data = await apiRequest(endpoint, { token });
        if (mounted) setCourses(data || []);
      } catch (e) {
        if (mounted) setError(e.message || 'Failed to load courses');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [token, user?.role]);

  async function onJoinCourse(e) {
    e.preventDefault();
    if (!joinCode) return;
    setSubmitting(true);
    setError('');
    try {
      await apiRequest('/api/enrollments', { method: 'POST', token, body: { course_code: joinCode } });
      setJoinCode('');
      // reload courses after enrolling
      const data = await apiRequest('/api/courses', { token });
      setCourses(data || []);
    } catch (e) {
      setError(e.message || 'Failed to enroll');
    } finally {
      setSubmitting(false);
    }
  }

  // Removed teacher inline create form per request

  const containerStyle = { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#d5ceed' };

  // Memoize filtered list and the rendered CourseCard list to avoid re-renders
  const filteredCourses = useMemo(() => {
    const ql = q.toLowerCase();
    return (courses || []).filter(c => `${c.name || c.course_name || ''} ${c.description || ''} ${c.teacher?.username || ''}`.toLowerCase().includes(ql));
  }, [courses, q]);
  const courseCardList = useMemo(() => (
    filteredCourses.map(c => (
      <CourseCard key={c.id} course={c} onClick={() => navigate(`/course/${c.id}`)} />
    ))
  ), [filteredCourses, navigate]);

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 className="collection-title" style={{ margin: 0 }}>Your Collection</h1>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginLeft:'auto' }}>
                {!( !isTeacher && courses.length === 0 ) && (
                  <div className="search-rounded">
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your courses" />
                    <SearchIcon sx={{ color: '#6a3ecb' }} />
                  </div>
                )}
                {isTeacher && (
                  <button className="btn-orange" onClick={() => setOpenCreate(true)}>Create Course</button>
                )}
              </div>
            </div>
  

            {error && (
              <div style={{ background: '#fdecea', color: '#611a15', padding: 12, borderRadius: 8, marginBottom: 12 }}>{error}</div>
            )}

            {false && isTeacher && null}

            {!isTeacher && (
              <form onSubmit={onJoinCourse} style={{ background: '#fff', padding: 16, borderRadius: 16, boxShadow: '0 10px 24px rgba(0,0,0,0.08)', marginBottom: 16 }}>
                <h4 style={{ marginTop: 0, marginBottom: 12 }}>Join A Private Course</h4>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                    placeholder="Enter Course Code"
                    id="join-code-input"
                    style={{ flex: 1, minWidth: 220, padding: 12, borderRadius: 12, border: '1px solid #eadcff', background: '#faf7ff' }}
                  />
                  <button
                    disabled={submitting}
                    type="submit"
                    style={{ padding: '10px 16px', borderRadius: 999, border: 'none', background: theme.palette.primary.main, color: '#fff', fontWeight: 800, boxShadow: '0 8px 18px rgba(255,20,147,0.25)', transition: 'transform .12s ease, background .12s ease' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#6a3ecb'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = theme.palette.primary.main; }}
                  >
                    {submitting ? 'Joining...' : 'Join'}
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <div className="loader-container">
                <div className="loader"></div>
                <div className="loader-text">Loading...</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginTop: 12 }}>
                {courseCardList}
                {courses.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                    <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(106,62,203,0.15)', maxWidth: 700, width: '100%', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#ff7ab6', boxShadow: '0 6px 14px rgba(255,20,147,0.25)' }} />
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#8ec5ff', boxShadow: '0 6px 14px rgba(26,115,232,0.25)' }} />
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#cda7ff', boxShadow: '0 6px 14px rgba(106,62,203,0.25)' }} />
                      </div>
                      <div style={{ fontFamily: 'Kodchasan, system-ui', fontWeight: 800, fontSize: 22, color: '#6a3ecb' }}>
                        {isTeacher ? 'No courses yet!' : "You're not enrolled yet!"}
                      </div>
                      <div style={{ marginTop: 8, opacity: 0.8 }}>
                        {isTeacher ? 'Create your first bubbly course and invite students.' : 'Discover new courses or join one with a code.'}
                      </div>
                      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                        {isTeacher ? (
                          <button onClick={() => setOpenCreate(true)} style={{ padding: '10px 16px', borderRadius: 999, border: 'none', background: theme.palette.primary.main, color: '#fff', fontWeight: 800, boxShadow: '0 10px 24px rgba(255,20,147,0.3)' }}>Create Course</button>
                        ) : (
                          <>
                            <button
                              onClick={() => navigate('/discover')}
                              style={{ padding: '10px 16px', borderRadius: 999, border: '2px solid transparent', background: theme.palette.primary.main, color: '#fff', fontWeight: 800, boxShadow: '0 12px 28px rgba(221,38,128,0.28)', transition:'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease, box-shadow .12s ease' }}
                              onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.background='#fff'; e.currentTarget.style.color=theme.palette.primary.main; e.currentTarget.style.borderColor=theme.palette.primary.main; e.currentTarget.style.boxShadow='0 14px 30px rgba(221,38,128,0.30)'; }}
                              onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.background=theme.palette.primary.main; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.boxShadow='0 12px 28px rgba(221,38,128,0.28)'; }}
                            >
                              Discover Courses
                            </button>
                            <button
                              onClick={() => document.querySelector('#join-code-input')?.focus()}
                              style={{ padding: '10px 16px', borderRadius: 999, border: '2px solid #e6e0f4', background: '#fff', color: '#6a3ecb', fontWeight: 800, boxShadow:'0 10px 24px rgba(106,62,203,0.15)', transition:'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease, box-shadow .12s ease' }}
                              onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='#6a3ecb'; e.currentTarget.style.boxShadow='0 14px 30px rgba(106,62,203,0.22)'; }}
                              onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#6a3ecb'; e.currentTarget.style.borderColor='#e6e0f4'; e.currentTarget.style.boxShadow='0 10px 24px rgba(106,62,203,0.15)'; }}
                            >
                              Have a code?
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {isTeacher ? (
                  null
                ) : (
                  courses.length > 0 && (
                    <button
                      onClick={() => navigate('/discover')}
                      style={{ padding: '10px 16px', borderRadius: 999, border: 'none', background: theme.palette.primary.main, color: '#fff', fontWeight: 800, boxShadow: '0 8px 18px rgba(26,115,232,0.25)', transition: 'transform .12s ease, background .12s ease' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#6a3ecb'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = theme.palette.primary.main; }}
                    >
                      Discover Courses
                    </button>
                  )
                )}
              </div>
            </div>
            {openCreate && (
              <CourseCreateForm token={token} onClose={() => setOpenCreate(false)} onCreated={async () => {
                try { const endpoint = (user?.role === 'teacher') ? '/api/courses' : '/api/me/courses'; const data = await apiRequest(endpoint, { token }); setCourses(data || []); } catch(_) {}
              }} />
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
