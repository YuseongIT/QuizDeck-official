// theme.js
import React from 'react';
import { createTheme, ThemeProvider, styled } from '@mui/material/styles';
import { 
  Box, 
  Paper, 
  Typography, 
  Tabs, 
  Tab 
} from '@mui/material';

// --- 1. Custom MUI Theme Setup ---
const theme = createTheme({
  palette: {
    primary: {
      main: '#F94D93', // Header Pink/Magenta
    },
    secondary: {
      main: '#8A60C0', // Purple accents
    },
    action: {
      main: '#F5A623', // Orange buttons
      hover: '#D4901F',
    },
    background: {
      default: '#F5F5F9', // Light background for the page
      sidebar: '#775EF0',
    },
    card: {
      purple: '#775EF0',
      yellow: '#FFAE0B',
      pink: '#F94D93',
    },
  },
  typography: {
    fontFamily: [
      'Kodchasan',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  shape: {
    borderRadius: 8,
    customButtonWidth: 300,
    customButtonRadius: 32
  }
});

// --- 2. Styled Components for Layout/Custom Design ---

// Main Application Container with the custom background
const MainBackground = styled(Box)(({ theme }) => ({
  position: 'relative',
  minHeight: 'calc(100vh - 64px)', // Account for the 64px header
  padding: theme.spacing(4, 0),
  overflow: 'hidden',

  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Custom wavy SVG background mimicking the image's colors/shape
    backgroundImage: `url("https://www.creativefabrica.com/wp-content/uploads/2021/06/17/Colorful-pastel-minimalist-background-Graphics-13503939-1-1-580x383.png")`,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    opacity: 0.8,
    zIndex: 0,
  },
}));

// Container for the QuizDeck Logo and CTA
const LogoContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  [theme.breakpoints.up('md')]: {
    alignItems: 'flex-start',
  },
  zIndex: 1,
}));

// Custom box for the 'Join QuizDeck' CTA
const CtaBox = styled(Paper)(({ theme, bgcolor, textcolor }) => ({
  backgroundColor: bgcolor || theme.palette.secondary.main,
  color: textcolor || 'white',
  padding: theme.spacing(3),
  marginTop: theme.spacing(3),
  maxWidth: '300px',
  borderRadius: theme.shape.borderRadius * 2,
  boxShadow: theme.shadows[10],
}));

// --- 3. Exported Components ---

// Wrapper to apply the theme to the entire app
export const CustomThemeProvider = ({ children }) => (
  <ThemeProvider theme={theme}>
    {children}
  </ThemeProvider>
);

// Header Component
export const Header = ({ title }) => (
  <Box sx={{ 
    height: 64, 
    backgroundColor: 'primary.main', 
    display: 'flex', 
    alignItems: 'center', 
    px: 3 
  
  }}>
    <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'white' }}>
      {title}
    </Typography>
  </Box>
);

// Role Toggle Switch (Student/Teacher)
export const RoleToggle = ({ role, setRole }) => {
  const handleChange = (event, newValue) => {
    setRole(newValue);
  };

  return (
    <Paper 
      sx={{ 
        bgcolor: theme.palette.secondary.main, 
        p: 0.5, 
        borderRadius: 20, 
        display: 'block', 
        mx: 'auto', 
        width: 'fit-content', // Essential to prevent it from spanning the whole width        
        boxShadow: 1
      }}
      elevation={0}
    >
      <Tabs 
        value={role} 
        onChange={handleChange} 
        sx={{ minHeight: 'auto', '& .MuiTabs-indicator': { display: 'none' } }}
      >
        <Tab 
          value="Student" 
          label="Student" 
          sx={{ 
            minHeight: 'auto', minWidth: 'auto', p: '4px 16px', borderRadius: 20, 
            bgcolor: role === 'Student' ? 'white' : 'transparent', 
            color: role === 'Student' ? 'secondary.main' : 'white',
            fontWeight: role === 'Student' ? 'bold' : 'normal',
            boxShadow: role === 'Student' ? 3 : 0, 
            transition: 'all 0.3s'
          }}
        />
        <Tab 
          value="Teacher" 
          label="Teacher" 
          sx={{ 
            minHeight: 'auto', minWidth: 'auto', p: '4px 16px', borderRadius: 20, 
            bgcolor: role === 'Teacher' ? 'white' : 'transparent', 
            color: role === 'Teacher' ? 'secondary.main' : 'white',
            fontWeight: role === 'Teacher' ? 'bold' : 'normal',
            boxShadow: role === 'Teacher' ? 3 : 0,
            transition: 'all 0.3s'
          }}
        />
      </Tabs>
    </Paper>
  );
};

// Login Form Card
export const AuthCard = ({ children }) => (
  <Paper elevation={10} sx={{ p: 4, borderRadius: 3, maxWidth: 400, width: '100%', zIndex: 1 }}>
    {children}
  </Paper>
);

// Layout constants and styles used by Dashboard and Sidebars
export const dimensions = {
  sidebarWidth: '300px',
  headerHeight: '64px',
};

export const transitions = {
  sidebarSlide: 'transform 0.3s ease-out',
};

export const sidebarStyles = {
  base: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    width: dimensions.sidebarWidth,
    zIndex: 200,
    boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
    transition: transitions.sidebarSlide,
    backgroundColor: theme.palette.background.sidebar,
    overflowY: 'auto',
    overflowX: 'visible',
    boxSizing: 'border-box',
  },
  leftClosed: {
    left: 0,
    transform: 'translateX(-100%)',
    paddingTop: dimensions.headerHeight,
  },
  leftOpen: {
    transform: 'translateX(0)',
  },
  rightClosed: {
    right: 0,
    transform: 'translateX(100%)',
    paddingTop: dimensions.headerHeight,
  },
  rightOpen: {
    transform: 'translateX(0)',
    paddingTop: dimensions.headerHeight,
  },
};

export const mainContentStyles = {
  base: {
    flexGrow: 1,
    padding: '16px',
    margin: '0 auto',
    maxWidth: '1000px',
    width: '100%',
    boxSizing: 'border-box',
  },
};

export const overlayStyles = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.4)',
  zIndex: 150,
  cursor: 'pointer',
};

// QuizDeck Logo Icon Placeholder
export const QuizDeckLogo = () => (
    <Box sx={{ 
        width: 220, 
        height: 160, 
        position: 'relative', 
        overflow: 'hidden', 
        borderRadius: 2, 
        p: 2,
        backgroundColor: 'rgba(255,255,255,0.7)',
        boxShadow: 3
    }}>
        {/* Yellow Card (Rotated) */}
        <Box sx={{
            position: 'absolute', top: 5, left: 15, width: 150, height: 130, 
            backgroundColor: '#FFEB3B', opacity: 0.9, transform: 'rotate(-10deg)', 
            borderRadius: 2, zIndex: 1, border: '3px solid #FFC107'
        }} />
        {/* Purple Card (Rotated) */}
        <Box sx={{
            position: 'absolute', top: 15, left: 35, width: 170, height: 140, 
            backgroundColor: theme.palette.secondary.main, transform: 'rotate(5deg)', 
            borderRadius: 2, zIndex: 2
        }}>
            <Typography variant="h4" sx={{ 
                fontWeight: '900', color: 'white', 
                textAlign: 'center', mt: 4, 
                textShadow: '2px 2px #512DA8'
            }}>
                QUIZ DECK
            </Typography>
        </Box>
        {/* 'Q' and 'D' letters on the corners */}
        <Typography sx={{ position: 'absolute', top: 10, left: 5, color: 'white', fontWeight: 'bold', zIndex: 3 }}>Q</Typography>
        <Typography sx={{ position: 'absolute', bottom: 10, right: 5, color: 'white', fontWeight: 'bold', zIndex: 3 }}>D</Typography>
    </Box>
);

export {
  MainBackground, 
  LogoContainer, 
  CtaBox, 
  theme
};
