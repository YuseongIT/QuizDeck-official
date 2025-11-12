import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { apiRequest } from './api';
import { CustomThemeProvider, theme, overlayStyles } from './theme';
import Header from './Header';
import SidebarLeft from './SidebarLeft';
import { Box, Container, Paper, Typography, TextField, Button, Divider, Snackbar, Alert, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const Section = ({ title, children }) => (
  <Paper elevation={6} style={{ padding: 16, borderRadius: 12, marginBottom: 16 }}>
    <Typography variant="h6" style={{ fontWeight: 800, marginBottom: 8 }}>{title}</Typography>
    {children}
  </Paper>
);

const Settings = () => {
  const { token, user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [snack, setSnack] = useState({ open: false, severity: 'success', message: '' });
  const [confirmDlg, setConfirmDlg] = useState({ open:false, message:'', onYes:null });
  const [usernameError, setUsernameError] = useState('');
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyRequested, setVerifyRequested] = useState(() => {
    try { return sessionStorage.getItem('qd_verification_requested') === '1'; } catch(_) { return false; }
  });
  const [justVerified, setJustVerified] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiRequest('/api/user/profile', { token });
        if (!mounted) return;
        setUsername(data.user.username || '');
        setEmail(data.user.email || '');
        setRole(data.user.role || '');
      } catch (e) {
        setSnack({ open: true, severity: 'error', message: e.message || 'Failed to load profile' });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [token]);

  // Show a one-time congratulatory chip after verification redirect
  useEffect(() => {
    try {
      const flag = sessionStorage.getItem('qd_verified_just_now');
      if (flag === '1') {
        setJustVerified(true);
        sessionStorage.removeItem('qd_verified_just_now');
        // Auto-hide after a few seconds
        const t = setTimeout(() => setJustVerified(false), 5000);
        return () => clearTimeout(t);
      }
    } catch (_) {}
  }, []);

  const onSaveProfile = async (e) => {
    e.preventDefault();
    // Validate username has no whitespace
    if (!username || /\s/.test(username)) {
      setUsernameError('Username cannot contain spaces.');
      setSnack({ open: true, severity: 'error', message: 'Username cannot contain spaces.' });
      return;
    }
    setSavingProfile(true);
    try {
      const data = await apiRequest('/api/user/update', { method: 'PUT', token, body: { username, email } });
      setSnack({ open: true, severity: 'success', message: data.message || 'Profile updated' });
      setUser({ ...(user || {}), username: data.user.username, email: data.user.email });
    } catch (e) {
      setSnack({ open: true, severity: 'error', message: e.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setSnack({ open: true, severity: 'error', message: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setSnack({ open: true, severity: 'error', message: 'Passwords do not match.' });
      return;
    }
    setSavingPassword(true);
    try {
      const data = await apiRequest('/api/user/update-password', { method: 'PUT', token, body: { currentPassword, newPassword, confirmNewPassword } });
      setSnack({ open: true, severity: 'success', message: data.message || 'Password updated' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (e) {
      setSnack({ open: true, severity: 'error', message: e.message });
    } finally {
      setSavingPassword(false);
    }
  };

  const onDelete = async () => {
    if (!currentPassword) {
      setSnack({ open: true, severity: 'error', message: 'Enter your current password in the Password section before deleting.' });
      return;
    }
    setConfirmDlg({
      open:true,
      message:'Are you sure you want to permanently delete your account? This cannot be undone.',
      onYes: async () => {
        setDeleting(true);
        try {
          const data = await apiRequest('/api/user/delete', { method: 'DELETE', token, body: { currentPassword } });
          setSnack({ open: true, severity: 'success', message: data.message || 'Account deleted' });
          await logout();
          navigate('/signup');
        } catch (e) {
          setSnack({ open: true, severity: 'error', message: e.message });
        } finally {
          setDeleting(false);
          setConfirmDlg({ open:false, message:'', onYes:null });
        }
      }
    });
  };

  if (loading) {
    return (
      <CustomThemeProvider>
        <div className="loader-container">
          <div className="loader"></div>
          <div className="loader-text">Loading...</div>
        </div>
      </CustomThemeProvider>
    );
  }

  return (
    <CustomThemeProvider>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#d6ceed' }}>
        <Header 
          isDashboard={true}
          isLeftOpen={isLeftOpen}
          isRightOpen={false}
          toggleLeft={() => setIsLeftOpen(!isLeftOpen)}
          toggleRight={() => {}}
          showRightGroup={false}
          showDbStatus={false}
        />
        <div style={{ position: 'relative', flexGrow: 1 }}>
          <SidebarLeft isOpen={isLeftOpen} />
          <Container maxWidth="lg" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <IconButton aria-label="Back" onClick={() => navigate(-1)} sx={{ color: theme.palette.secondary.main }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 800, color: theme.palette.secondary.main }}>Back</Typography>
        </Box>
        <Typography variant="h4" style={{ fontWeight: 900, color: theme.palette.secondary.main, marginBottom: 16 }}>Settings</Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(390px, 1fr))' }, gap: 3 }}>
          <Section title="Profile Settings">
            <form onSubmit={onSaveProfile}>
              <TextField 
                label="Username" 
                fullWidth 
                margin="normal" 
                value={username} 
                onChange={(e) => {
                  const v = e.target.value;
                  if (/\s/.test(v)) {
                    // Strip all whitespace immediately
                    const cleaned = v.replace(/\s+/g, '');
                    setUsername(cleaned);
                    setUsernameError('Username cannot contain spaces.');
                  } else {
                    setUsername(v);
                    setUsernameError('');
                  }
                }} 
                inputProps={{ pattern: "[^\\s]+" }}
                error={!!usernameError}
                helperText={usernameError || 'No spaces allowed. Use letters, numbers, underscores.'}
              />
              <TextField label="Email" type="email" fullWidth margin="normal" value={email} onChange={(e) => setEmail(e.target.value)} />
              <TextField label="Role" fullWidth margin="normal" value={role} disabled />
              <Box display="flex" gap={1} marginTop={1}>
                <Button type="submit" variant="contained" disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save Changes'}</Button>
              </Box>
            </form>
          </Section>

          <Section title="Password Settings">
            <form onSubmit={onChangePassword}>
              <TextField label="Current Password" type="password" fullWidth margin="normal" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              <TextField label="New Password" type="password" fullWidth margin="normal" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <TextField label="Confirm New Password" type="password" fullWidth margin="normal" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
              <Box display="flex" gap={1} marginTop={1}>
                <Button type="submit" variant="contained" disabled={savingPassword}>{savingPassword ? 'Updating...' : 'Change Password'}</Button>
              </Box>
            </form>
          </Section>
        </Box>

        <Section title="Account Management">
          <Typography variant="body2" color="text.secondary">This will permanently delete your account and all associated data.</Typography>
          <Box display="flex" gap={1} marginTop={2}>
            <Button color="error" variant="contained" onClick={onDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete Account'}</Button>
            <Button variant="outlined" onClick={async () => { await logout(); navigate('/login'); }}>Logout</Button>
          </Box>
        </Section>

        {/* Removed Account Verification section */}

        <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}>
          <Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.severity} sx={{ width: '100%' }}>
            {snack.message}
          </Alert>
        </Snackbar>
          </Container>
          {isLeftOpen && (
            <div style={overlayStyles} onClick={() => setIsLeftOpen(false)} />
          )}
        </div>
      </div>
      {confirmDlg.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.28)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:120 }}>
          <div style={{ width:420, maxWidth:'92vw', background:'#fff', borderRadius:16, boxShadow:'0 18px 44px rgba(0,0,0,.22)', overflow:'hidden', fontFamily:'Kodchasan, system-ui' }}>
            <div style={{ background:'#dd2680', color:'#fff', fontWeight:900, padding:'10px 14px' }}>QuizDeck</div>
            <div style={{ padding:16, fontSize:16 }}>{confirmDlg.message}</div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:16 }}>
              <button
                onClick={() => setConfirmDlg({ open:false, message:'', onYes:null })}
                style={{ padding:'10px 14px', border:'2px solid #6a3ecb', background:'#fff', color:'#6a3ecb', fontWeight:900, borderRadius:12, transition:'transform .12s ease, background .12s ease, color .12s ease, box-shadow .12s ease, border-color .12s ease' }}
                onMouseEnter={e=>{ e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 12px 24px rgba(106,62,203,.22)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#6a3ecb'; e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; }}
              >Cancel</button>
              <button
                onClick={() => { const fn=confirmDlg.onYes; if (fn) fn(); }}
                style={{ padding:'10px 14px', borderRadius:12, border:'2px solid #d9254f', background:'#d9254f', color:'#fff', fontWeight:900, transition:'transform .12s ease, background .12s ease, color .12s ease, box-shadow .12s ease, border-color .12s ease' }}
                onMouseEnter={e=>{ e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#d9254f'; e.currentTarget.style.boxShadow='0 12px 24px rgba(217,37,79,.22)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.background='#d9254f'; e.currentTarget.style.color='#fff'; e.currentTarget.style.boxShadow='none'; }}
              >Delete</button>
            </div>
          </div>
        </div>
      )}
      {/* Removed verification modal */}
    </CustomThemeProvider>
  );
};

export default Settings;
