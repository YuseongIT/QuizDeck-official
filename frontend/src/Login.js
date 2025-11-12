import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { 
  Header, 
  AuthCard, 
  RoleToggle, 
  MainBackground, 
  LogoContainer, 
  CtaBox,
  CtaBoxLogin,
  CustomThemeProvider,
  theme
} from './theme'; 


import { 
  Box, 
  Container, 
  Button, 
  TextField, 
  Typography, 
  Divider, 
  Link, 
  IconButton,
  InputAdornment 
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Student');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter email and password.');
      return;
    }
    try {
      const roleValue = role.toLowerCase() === 'teacher' ? 'teacher' : 'student';
      const data = await login({ email, password, role: roleValue });
      if (data?.user?.is_admin && roleValue === 'teacher') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <CustomThemeProvider>
      <link 
        rel="stylesheet" 
        href="https://fonts.googleapis.com/css2?family=Kodchasan:wght@400;700;900&display=swap"
      />

      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          bgcolor: theme.palette.primary.main,
          boxShadow: 1,
        }}
      >
        <IconButton
          edge="start"
          color="inherit"
          onClick={() => navigate('/')}
          sx={{ mr: 1, color: 'white' }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'white' }}>
          QuizDeck
        </Typography>
      </Box>

      <MainBackground>
        <Container maxWidth="lg" sx={{ zIndex: 1 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'center',
              alignItems: 'center',
              gap: { xs: 8, md: 17 },
              py: 2,
            }}
          >
            {/* Left Section */}
            <LogoContainer sx={{ flexShrink: 0, alignItems: 'center !important', textAlign: 'center' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Box
                  component="img"
                  src="./qd.png"
                  alt="QuizDeck Logo"
                  sx={{
                    width: { xs: 220, md: 370 },
                    height: 'auto',
                    mb: 1.5,
                    objectFit: 'contain',
                    animation: 'float 3s ease-in-out infinite',
                    '@keyframes float': {
                      '0%': { transform: 'translateY(0)' },
                      '50%': { transform: 'translateY(-10px)' },
                      '100%': { transform: 'translateY(0)' },
                    },
                  }}
                />

                <CtaBox bgcolor={theme.palette.action.main} textcolor="white">
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    Welcome back, Scholar!
                  </Typography>
                  <Typography variant="subtitle1" sx={{ mt: 0.5 }}>
                    Ready for another fun-filled learning session?
                  </Typography>
                </CtaBox>
              </Box>
            </LogoContainer>

            {/* Right Section */}
            <Box 
              sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',                
                gap: 2, 
                width: { xs: '100%', md: 'auto' } 
              }}
            >
              <RoleToggle role={role} setRole={setRole} />
              
              <AuthCard>
                <form onSubmit={handleLogin}>
                  <Typography 
                    variant="h5" 
                    align="center" 
                    sx={{ fontWeight: 'bold', mb: 1, color: theme.palette.secondary.main, color:'#f5a623' }}
                  >
                    Log In
                  </Typography>

                  <Divider sx={{ my: 2, borderBottomWidth: 3, borderColor: '#f5a623' }} />

                  <TextField
                    label="E-mail"
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <TextField
                    label="Password"
                    variant="outlined"
                    type={showPassword ? 'text' : 'password'}
                    fullWidth
                    margin="normal"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            onClick={() => setShowPassword((s) => !s)}
                            edge="end"
                            sx={{ color: theme.palette.action.main }}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />

                  {error && (
                    <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                      {error}
                    </Typography>
                  )}

                  <Button
                    variant="contained"
                    type="submit"
                    fullWidth
                    size="large"
                    sx={{ 
                      mt: 3, 
                      display: 'block',
                      mx: 'auto',
                      bgcolor: theme.palette.action.main, 
                      borderRadius: theme.shape.customButtonRadius,               
                      width: theme.shape.customButtonWidth,
                      '&:hover': { bgcolor: theme.palette.action.hover }
                    }}
                  >
                    Log In
                  </Button>
                </form>
                
                <Typography variant="body2" align="center" sx={{ mt: 2, color: 'text.secondary' }}>
                  Don't have an account yet?{' '}
                  <Link
                    underline="hover"
                    color="secondary"
                    sx={{ fontWeight: 'bold', cursor: 'pointer' }}
                    onClick={() => navigate('/signup')}
                  >
                    Sign Up
                  </Link>
                </Typography>
              </AuthCard>
            </Box>
          </Box>
        </Container>
      </MainBackground>
    </CustomThemeProvider>
  );
};

export default LoginPage;
