import React, { useEffect, useState } from 'react';
import { Button, Typography, Box } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { sidebarStyles, theme } from './theme';
import { apiRequest } from './api';

// Define the style for the course link buttons once to eliminate duplication
const CourseLinkButtonStyle = {
    // --- Centering and Sizing ---
    width: '90%', // Set the width to 90%
    margin: '0 auto 5px auto', // Key change: 'auto' centers the 90% block horizontally, and '5px' adds bottom spacing
    borderRadius: '5px',
    
    // --- Appearance and Behavior ---
    padding: '10px 15px',
    cursor: 'pointer',
    textAlign: 'left',
    justifyContent: 'flex-start',
    textTransform: 'none', // Prevent ALL CAPS default
    
    // Solid Dark Button Style to match the image
    backgroundColor: '#412FA9', // Dark Purple background
    color: theme.palette.lightText || '#FFFFFF', // White text color

    transition: 'transform 0.15s ease, box-shadow 0.15s ease, background-color 0.2s ease, color 0.2s ease',
    transform: 'scale(1.0)',
    '&:hover': {
        // A slightly darker shade for hover effect
        backgroundColor: '#35258A', 
        color: theme.palette.lightText || '#FFFFFF',
        transform: 'translateY(-1px) scale(1.02)',
        boxShadow: '0 6px 0 rgba(0,0,0,0.25)'
    }
};


const SidebarLeft = ({ isOpen }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, token, user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(false);
    const isHomeActive = location.pathname === '/dashboard' || location.pathname === '/';
    const isSettingsActive = location.pathname === '/settings';
    // Merge base, closed, and open styles conditionally
    const combinedStyle = {
        ...sidebarStyles.base,
        ...sidebarStyles.leftClosed,
        ...(isOpen ? sidebarStyles.leftOpen : {}),
        backgroundColor: '#8a61c1',
        paddingLeft: '20px',
        paddingRight: '20px',
        display: 'flex',
        flexDirection: 'column',
    };

    // Base style for all dashboard navigation items (Home, Quizzes, Profile, Settings)
    const dashboardItemBaseStyle = {
        // We use the Button component now, so some styles are moved to the Button's default props or sx prop
        padding: '12px',
        margin: '10px 20px', // Increased spacing and left gap
        borderRadius: '4px',
        cursor: 'pointer',
        textTransform: 'none', // Important for MUI Button
        justifyContent: 'center', // Center content horizontally
        minWidth: 'unset', // Allow button to shrink
        width: '100%', // Force uniform width inside the grid
        color: theme.palette.background.default,
        backgroundColor: theme.palette.action.main, 
        fontWeight: theme.typography.body1.fontWeight, // Use theme body weight
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, background-color 0.2s, color 0.2s',
        transform: 'none',
        '&:hover': {
            backgroundColor: theme.palette.action.hover,
            transform: 'translateY(-1px) scale(1.02)',
            boxShadow: '0 6px 0 rgba(0,0,0,0.3), 0 10px 16px rgba(0,0,0,0.2)'
        }
    };

    // Active style specific to the 'Home' item
    const activeItemStyle = {
        backgroundColor: theme.palette.action.hover, // Use the specific main color
        color: theme.palette.background.default,
        fontWeight: 'bold',
        '&:hover': {
            backgroundColor: theme.palette.primary.dark, // A slightly darker hover for active state
        }
    };

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            try {
                const endpoint = (user?.role === 'teacher') ? '/api/courses' : '/api/me/courses';
                const data = await apiRequest(endpoint, { token });
                if (mounted) setCourses(Array.isArray(data) ? data : []);
            } catch (_) {
                if (mounted) setCourses([]);
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        const onUpdate = () => load();
        window.addEventListener('courses:update', onUpdate);
        return () => { mounted = false; window.removeEventListener('courses:update', onUpdate); };
    }, [token, user?.role]);

    const gotoCourse = (id) => {
        navigate(`/course/${encodeURIComponent(id)}`);
    };

    return (
        <nav style={combinedStyle}>
            {/* Dashboard Section */}
            <Box sx={{ padding: '16px 20px', backgroundColor: '#8a61c1'}}>
                <Typography variant="h6" sx={{ color: theme.palette.background.default, fontWeight: 'bold', mb: 1 }}>
                    Dashboard
                </Typography>
                {/* Grid of action buttons with icons from /public, ordered as: Home, Profile, Announcements, Settings, Courses, Quizzes */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    {/* Home */}
                    <Button onClick={() => navigate('/dashboard')} sx={{
                        ...dashboardItemBaseStyle,
                        m: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        border: '3px solid #2d1c3f',
                        borderRadius: '14px',
                        boxShadow: isHomeActive ? '0 5px 0 rgba(0,0,0,0.4), 0 8px 14px rgba(0,0,0,0.25)' : '0 4px 0 rgba(0,0,0,0.35), 0 6px 12px rgba(0,0,0,0.2)',
                        color: '#2d1c3f',
                        backgroundColor: isHomeActive ? '#d67f10' : '#ffae0b',
                        transform: 'none',
                        transition: 'transform 0.15s ease'
                    }}>
                        <img src="/home.png" alt="Home" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                        <Typography variant="body2" sx={{ color: 'inherit', fontWeight: 'inherit' }}>Home</Typography>
                    </Button>
                    {/* Profile */}
                    <Button onClick={() => navigate('/profile')} sx={{ ...dashboardItemBaseStyle, m: 0, display: 'flex', flexDirection: 'column', gap: 1, border: '3px solid #2d1c3f', borderRadius: '14px', boxShadow: '0 4px 0 rgba(0,0,0,0.35), 0 6px 12px rgba(0,0,0,0.2)', color: '#2d1c3f', backgroundColor: '#ffae0b' }}>
                        <img src="/profile.png" alt="Profile" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                        <Typography variant="body2" sx={{ color: 'inherit', fontWeight: 'inherit' }}>Profile</Typography>
                    </Button>
                    {/* Announcements */}
                    <Button onClick={() => navigate('/announcements')} sx={{ ...dashboardItemBaseStyle, m: 0, display: 'flex', flexDirection: 'column', gap: 1, border: '3px solid #2d1c3f', borderRadius: '14px', boxShadow: '0 4px 0 rgba(0,0,0,0.35), 0 6px 12px rgba(0,0,0,0.2)', color: '#2d1c3f', backgroundColor: '#ffae0b' }}>
                        <img src="/announcements.png" alt="Announcements" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                        <Typography variant="body2" sx={{ color: 'inherit', fontWeight: 'inherit' }}>Updates</Typography>
                    </Button>
                    {/* Settings */}
                    <Button onClick={() => navigate('/settings')} sx={{ 
                        ...dashboardItemBaseStyle, 
                        m: 0, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: 1, 
                        border: '3px solid #2d1c3f', 
                        borderRadius: '14px', 
                        boxShadow: isSettingsActive ? '0 5px 0 rgba(0,0,0,0.4), 0 8px 14px rgba(0,0,0,0.25)' : '0 4px 0 rgba(0,0,0,0.35), 0 6px 12px rgba(0,0,0,0.2)', 
                        color: '#2d1c3f', 
                        backgroundColor: isSettingsActive ? '#d67f10' : '#ffae0b', 
                        transform: 'none', 
                        transition: 'transform 0.15s ease',
                        '&:hover': {
                            transform: 'translateY(-1px)',
                            boxShadow: '0 6px 0 rgba(0,0,0,0.3), 0 10px 16px rgba(0,0,0,0.2)'
                        }
                    }}>
                        <img src="/settings.png" alt="Settings" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                        <Typography variant="body2" sx={{ color: 'inherit', fontWeight: 'inherit' }}>Settings</Typography>
                    </Button>
                    {/* Courses */}
                    <Button onClick={() => navigate('/courses')} sx={{ ...dashboardItemBaseStyle, m: 0, display: 'flex', flexDirection: 'column', gap: 1, border: '3px solid #2d1c3f', borderRadius: '14px', boxShadow: '0 4px 0 rgba(0,0,0,0.35), 0 6px 12px rgba(0,0,0,0.2)', color: '#2d1c3f', backgroundColor: '#ffae0b' }}>
                        <img src="/course.png" alt="Courses" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                        <Typography variant="body2" sx={{ color: 'inherit', fontWeight: 'inherit' }}>Courses</Typography>
                    </Button>
                    {/* Quizzes */}
                    <Button onClick={() => navigate('/quizzes')} sx={{ ...dashboardItemBaseStyle, m: 0, display: 'flex', flexDirection: 'column', gap: 1, border: '3px solid #2d1c3f', borderRadius: '14px', boxShadow: '0 4px 0 rgba(0,0,0,0.35), 0 6px 12px rgba(0,0,0,0.2)', color: '#2d1c3f', backgroundColor: '#ffae0b' }}>
                        <img src="/quizzes.png" alt="Quizzes" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                        <Typography variant="body2" sx={{ color: 'inherit', fontWeight: 'inherit' }}>Quizzes</Typography>
                    </Button>
                </Box>
            </Box>

            {/* Courses Section (dynamic) */}
            <Box sx={{ padding: '10px 0' }}>
                <Typography 
                    variant="h6" // Using a safe font weight from theme
                    sx={{ 
                        padding: '10px 15px', 
                        color: theme.palette.background.default, // Use secondary color
                        margin: '0',
                        fontWeight: theme.typography.fontWeightBold // Use theme weight safely
                    }}
                >
                    Courses 
                    <span onClick={() => navigate('/courses')} style={{ float: 'right', fontSize: '0.8em', color: theme.palette.text.secondary, fontWeight: 'normal', cursor: 'pointer', textDecoration: 'underline' }}>
                        View all
                    </span>
                </Typography>
                
                {loading ? (
                    <div className="loader-container" style={{ height: 140 }}>
                        <div className="loader"></div>
                        <div className="loader-text">Loading...</div>
                    </div>
                ) : (
                    (courses && courses.length > 0) ? (
                        courses.slice(0, 8).map(c => (
                            <Button key={c.id} onClick={() => gotoCourse(c.id)} sx={{ ...CourseLinkButtonStyle, display: 'flex', alignItems: 'center', gap: '10px' }} disableRipple>
                                <img src="/courseicons.png" alt="Course" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                                {c.course_name || c.name}
                            </Button>
                        ))
                    ) : (
                        <Box sx={{
                            width: '90%',
                            margin: '10px auto 0 auto',
                            p: 2,
                            borderRadius: '12px',
                            textAlign: 'center',
                            color: theme.palette.background.default,
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))',
                            border: '2px dashed rgba(0,0,0,0.15)'
                        }}>
                            <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
                                Hey, you don't have any courses yet.
                            </Typography>
                            <Button
                                onClick={() => navigate('/courses')}
                                sx={{
                                    px: 2,
                                    py: 0.5,
                                    borderRadius: '10px',
                                    backgroundColor: theme.palette.action.main,
                                    color: '#fff',
                                    fontWeight: 'bold',
                                    textTransform: 'none',
                                    '&:hover': { backgroundColor: theme.palette.action.hover }
                                }}
                                size="small"
                            >
                                Discover courses
                            </Button>
                        </Box>
                    )
                )}
            </Box>

            {/* Footer */}
            <Box sx={{ 
                mt: 'auto',
                width: '90%',
                mx: 'auto',
                padding: '15px 0', 
                backgroundColor: theme.palette.background.light,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                {/* Thicker, shortened divider */}
                <Box sx={{
                    height: '4px',
                    width: '100%',
                    mb: 2,
                    borderRadius: '6px',
                    backgroundColor: theme.palette.grey[300]
                }} />
                <Button sx={{ 
                    width: '80%', 
                    alignSelf: 'center',
                    display: 'block',
                    padding: '10px', 
                    backgroundColor: theme.palette.action.main, 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer', 
                    fontWeight: 'bold',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease, background-color 0.2s ease',
                    transform: 'scale(1.0)',
                    boxShadow: '0 4px 0 rgba(0,0,0,0.25)',
                    '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                        transform: 'translateY(-1px) scale(1.03)',
                        boxShadow: '0 6px 0 rgba(0,0,0,0.3)'
                    }
                }}
                onClick={async () => { await logout(); navigate('/login'); }}
                >
                    LOG OUT
                </Button>
            </Box>
        </nav>
    );
};

export default SidebarLeft;
