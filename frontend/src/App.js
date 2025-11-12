import { Routes, Route } from 'react-router-dom';
import LoginPage from './Login';
import SignUpPage from './SignUp';
import Dashboard from './Dashboard';
import Settings from './Settings';
import PrivateRoute from './PrivateRoute';
import Courses from './Courses';
import Quizzes from './Quizzes';
import Friends from './Friends';
import Announcements from './Announcements';
import Activity from './Activity';
import QuizzesPage from './pages/QuizzesPage';
import GradesPage from './pages/GradesPage';
import ManageQuizContentPage from './pages/ManageQuizContentPage';
import CourseManagementPage from './pages/CourseManagementPage';

// Import any other page components here (e.g., Dashboard)

function App() {
  return (
    // <Routes> determines which component renders based on the URL path
    <Routes>
      {/* Route for your login page (usually the default '/') */}
      <Route path="/" element={<LoginPage />} />
      
      {/* Route for your sign-up page */}
      <Route path="/signup" element={<SignUpPage />} />
      {/* Dashboard route (lowercase to match navigate) */}
      <Route path="/dashboard" element={
        <PrivateRoute>
          <Dashboard />
        </PrivateRoute>
      } />
      <Route path="/settings" element={
        <PrivateRoute>
          <Settings />
        </PrivateRoute>
      } />
      
      {/* Add more routes here, like for a protected dashboard */}
      {/* <Route path="/dashboard" element={<DashboardPage />} /> */}

      <Route path="/courses" element={
        <PrivateRoute>
          <Courses />
        </PrivateRoute>
      } />
      <Route path="/quizzes" element={
        <PrivateRoute>
          <QuizzesPage />
        </PrivateRoute>
      } />
      <Route path="/course/:id" element={
        <PrivateRoute>
          <CourseManagementPage />
        </PrivateRoute>
      } />
      {/* New quizzes module routes */}
      <Route path="/quizzes/new" element={
        <PrivateRoute>
          <QuizzesPage />
        </PrivateRoute>
      } />
      <Route path="/grades" element={
        <PrivateRoute>
          <GradesPage />
        </PrivateRoute>
      } />
      <Route path="/manage/quiz/:id" element={
        <PrivateRoute>
          <ManageQuizContentPage />
        </PrivateRoute>
      } />
      <Route path="/friends" element={
        <PrivateRoute>
          <Friends />
        </PrivateRoute>
      } />
      <Route path="/announcements" element={
        <PrivateRoute>
          <Announcements />
        </PrivateRoute>
      } />
      <Route path="/activity" element={
        <PrivateRoute>
          <Activity />
        </PrivateRoute>
      } />
    </Routes>
  );
}

export default App;