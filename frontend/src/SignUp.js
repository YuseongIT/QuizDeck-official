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

const SignUpPage = () => {
  const [role, setRole] = useState('Student');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !email || !password || !confirmPassword) {
      setError('Please fill out all fields.');
      return;
    }
    if (/\s/.test(username)) {
      setError('Username cannot contain spaces.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    try {
      const roleValue = role.toLowerCase() === 'teacher' ? 'teacher' : 'student';
      await signup({ username, email, password, role: roleValue });
      navigate('/login');
    } catch (err) {
      setError(err.message || 'Signup failed');
    }
  };

  return (
    <CustomThemeProvider>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Kodchasan:wght@400;700;900&display=swap"
      />

      {/* Header with Back Button */}
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
        <Typography
          variant="h6"
          sx={{ fontWeight: 'bold', color: 'white' }}
        >
          QuizDeck
        </Typography>
      </Box>

      {/* Main Content */}
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
            <LogoContainer
              sx={{
                flexShrink: 0,
                alignItems: 'center !important',
                textAlign: 'center',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                }}
              >
                <Box
                  component="img"
                  src="./quizdecklogo.png"
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

                <CtaBox bgcolor={theme.palette.secondary.main} textcolor="white">
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    Hey There!
                  </Typography>
                  <Typography variant="subtitle1" sx={{ mt: 0.5 }}>
                    Create your account and join QuizDeck today!
                  </Typography>
                </CtaBox>
              </Box>
            </LogoContainer>

            {/* Right Section: Signup Form */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                width: { xs: '100%', md: 'auto' },
              }}
            >
              <RoleToggle role={role} setRole={setRole} />

              <AuthCard>
                <form onSubmit={handleSignUp}>
                  <Typography
                    variant="h5"
                    align="center"
                    sx={{
                      fontWeight: 'bold',
                      mb: 1,
                      color: theme.palette.secondary.main,
                    }}
                  >
                    Sign Up
                  </Typography>

                  <Divider sx={{ my: 2, borderBottomWidth: 3, borderColor: '#8A60C0' }} />

                  <TextField
                    label="Username"
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
                    onKeyDown={(e) => { if (e.key === ' ') { e.preventDefault(); } }}
                    inputProps={{ pattern: "[^\\s]+", title: "No spaces allowed" }}
                  />
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
                            sx={{ color: '#7d5fff' }}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />
                  <TextField
                    label="Confirm Password"
                    variant="outlined"
                    type={showConfirm ? 'text' : 'password'}
                    fullWidth
                    margin="normal"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                            onClick={() => setShowConfirm((s) => !s)}
                            edge="end"
                            sx={{ color: '#7d5fff' }}
                          >
                            {showConfirm ? <VisibilityOff /> : <Visibility />}
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
                      bgcolor: '#7D5FFF',
                      borderRadius: theme.shape.customButtonRadius,
                      width: theme.shape.customButtonWidth,
                      transition: '0.3s ease',
                      '&:hover': {
                        bgcolor: '#6549CC',
                        transform: 'translateY(-3px)',
                      },
                    }}
                  >
                    Create Account
                  </Button>
                </form>

                <Typography
                  variant="body2"
                  align="center"
                  sx={{ mt: 2, color: 'text.secondary' }}
                >
                  Already have an account?{' '}
                  <Link
                    underline="hover"
                    color="secondary"
                    sx={{ fontWeight: 'bold', cursor: 'pointer' }}
                    onClick={() => navigate('/login')}
                  >
                    Log In
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

export default SignUpPage;
